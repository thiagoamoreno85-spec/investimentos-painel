import { and, desc, eq, lt } from "drizzle-orm";
import { marketFlowSnapshots } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  calculateEwzShareFlowProxy,
  formatBrtDate,
  summarizeLatestB3Sessions,
  type B3DailyInvestorFlow,
} from "../../shared/marketFlow";

const B3_FLOW_URL = "https://www.dadosdemercado.com.br/fluxo";
const EWZ_URL = "https://www.ishares.com/us/products/239612/ishares-msci-brazil-etf";
const FETCH_TIMEOUT_MS = 20_000;

function parseDecimal(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeHtml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function extractJsonArrayAfterMarker(html: string, marker: string): string | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const startIndex = html.indexOf("[", markerIndex);
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return html.slice(startIndex, index + 1);
    }
  }
  return null;
}

export function parseB3InvestorFlows(html: string): B3DailyInvestorFlow[] {
  const jsonArray = extractJsonArrayAfterMarker(html, "const data =");
  if (!jsonArray) throw new Error("Série diária de investidores não encontrada na fonte B3.");

  const parsed = JSON.parse(jsonArray) as Array<{
    date?: string;
    foreigners?: number | null;
    institutional?: number | null;
    individuals?: number | null;
    financial_institutions?: number | null;
    other?: number | null;
  }>;

  return parsed.flatMap((row) => {
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return [];
    return [{
      date: row.date,
      foreigners: Number(row.foreigners ?? 0),
      institutional: Number(row.institutional ?? 0),
      individuals: Number(row.individuals ?? 0),
      financialInstitutions: Number(row.financial_institutions ?? 0),
      other: Number(row.other ?? 0),
    }];
  });
}

export function parseEwzFundMetrics(html: string): { sharesOutstanding: number; netAssetsUsd: number; navUsd: number; asOf: string } {
  const text = decodeHtml(html);
  const findMetric = (name: string) => {
    const match = text.match(new RegExp(`"${name}":\\{[\\s\\S]*?"formattedValue":"([^"]+)"[\\s\\S]*?"formattedAsOfDate":"([^"]+)"`));
    if (!match) throw new Error(`Métrica ${name} indisponível na fonte iShares.`);
    const value = parseDecimal(match[1]);
    if (value === null) throw new Error(`Métrica ${name} inválida na fonte iShares.`);
    return { value, asOf: match[2] };
  };

  const shares = findMetric("sharesOutstanding");
  const assets = findMetric("totalNetAssetsFundLevel");
  const nav = findMetric("navAmount");
  return { sharesOutstanding: shares.value, netAssetsUsd: assets.value, navUsd: nav.value, asOf: shares.asOf };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestimentosPainel/1.0)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Fonte indisponível (${response.status}).`);
  return response.text();
}

export async function refreshMarketFlowSnapshot(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const [b3Html, ewzHtml] = await Promise.all([fetchText(B3_FLOW_URL), fetchText(EWZ_URL)]);
  const b3Summary = summarizeLatestB3Sessions(parseB3InvestorFlows(b3Html), 1);
  if (!b3Summary) throw new Error("Sem pregões válidos na série B3.");
  const ewz = parseEwzFundMetrics(ewzHtml);
  const snapshotDate = formatBrtDate(new Date());

  const [previous] = await db
    .select()
    .from(marketFlowSnapshots)
    .where(and(eq(marketFlowSnapshots.userId, userId), lt(marketFlowSnapshots.snapshotDate, snapshotDate)))
    .orderBy(desc(marketFlowSnapshots.snapshotDate))
    .limit(1);

  const proxy = calculateEwzShareFlowProxy(
    previous ? Number(previous.ewzSharesOutstanding ?? 0) : null,
    ewz.sharesOutstanding,
    ewz.navUsd,
  );

  const values = {
    userId,
    snapshotDate,
    b3ReportedThrough: b3Summary.reportedThrough,
    b3Sessions: b3Summary.sessions,
    b3ForeignFlowBrl: b3Summary.foreignFlowBRL.toFixed(2),
    b3DomesticFlowBrl: b3Summary.domesticFlowBRL.toFixed(2),
    ewzSharesOutstanding: ewz.sharesOutstanding.toFixed(2),
    ewzNetAssetsUsd: ewz.netAssetsUsd.toFixed(2),
    ewzNavUsd: ewz.navUsd.toFixed(4),
    ewzSharesChange: proxy?.sharesChange.toFixed(2) ?? null,
    ewzFlowProxyUsd: proxy?.flowProxyUsd.toFixed(2) ?? null,
    sourceB3: "B3 via Dados de Mercado — último pregão divulgado, sujeito à defasagem",
    sourceEwz: `iShares EWZ — dados de ${ewz.asOf}; proxy = variação de cotas × NAV`,
  };

  const [existing] = await db
    .select({ id: marketFlowSnapshots.id })
    .from(marketFlowSnapshots)
    .where(and(eq(marketFlowSnapshots.userId, userId), eq(marketFlowSnapshots.snapshotDate, snapshotDate)))
    .limit(1);

  if (existing) {
    await db.update(marketFlowSnapshots).set(values).where(eq(marketFlowSnapshots.id, existing.id));
  } else {
    await db.insert(marketFlowSnapshots).values(values);
  }

  return { ...values, ewzProxyAvailable: proxy !== null, updatedAt: new Date() };
}

export async function getMarketFlowDashboard(userId: number, limit = 160) {
  const db = await getDb();
  if (!db) return { latest: null, history: [] };
  const rows = await db
    .select()
    .from(marketFlowSnapshots)
    .where(eq(marketFlowSnapshots.userId, userId))
    .orderBy(desc(marketFlowSnapshots.snapshotDate))
    .limit(limit);

  return { latest: rows[0] ?? null, history: rows.reverse() };
}
