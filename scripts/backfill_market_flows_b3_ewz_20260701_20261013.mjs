import fs from "node:fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env" });

const START_DATE = "2026-07-01";
const END_DATE = "2026-10-13";
const B3_FLOW_URL = "https://www.dadosdemercado.com.br/fluxo";
const EWZ_SHARES_URL = "https://companiesmarketcap.com/ishares-msci-brazil-etf/shares-outstanding/";
const PRICE_FILE = new URL("../research/ewz_daily_prices_20260701_20261014.json", import.meta.url);

function extractJsonArrayAfterMarker(html, marker) {
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

function toIsoDate(epochSeconds) {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

function parseB3Rows(html) {
  const json = extractJsonArrayAfterMarker(html, "const data =");
  if (!json) throw new Error("Série B3 diária não encontrada.");
  return JSON.parse(json)
    .filter((row) => typeof row.date === "string" && row.date >= START_DATE && row.date <= END_DATE)
    .map((row) => ({
      date: row.date,
      foreignBrl: Number(row.foreigners ?? 0) * 1_000,
      domesticBrl: Number(row.institutional ?? 0) * 1_000
        + Number(row.individuals ?? 0) * 1_000
        + Number(row.financial_institutions ?? 0) * 1_000
        + Number(row.other ?? 0) * 1_000,
    }));
}

function parseEwzShares(html) {
  const match = html.match(/data\["view_6M"\]\s*=\s*(\[.*?\]);/s);
  if (!match) throw new Error("Série de cotas EWZ não encontrada.");
  const sourceRows = JSON.parse(match[1]);
  const byDate = new Map();
  for (const row of sourceRows) {
    const date = toIsoDate(Number(row.d));
    if (date >= START_DATE && date <= END_DATE && Number.isFinite(Number(row.v))) {
      byDate.set(date, Number(row.v));
    }
  }
  return byDate;
}

function parseEwzPrices() {
  const raw = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));
  const result = raw.chart?.result?.[0];
  if (!result) throw new Error("Arquivo de preços históricos EWZ inválido.");
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const prices = new Map();
  for (let index = 0; index < result.timestamp.length; index += 1) {
    const date = toIsoDate(Number(result.timestamp[index]));
    const close = Number(closes[index]);
    if (date >= START_DATE && date <= END_DATE && Number.isFinite(close) && close > 0) prices.set(date, close);
  }
  return prices;
}

const [b3Response, ewzSharesResponse] = await Promise.all([
  fetch(B3_FLOW_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestimentosPainel/1.0)" } }),
  fetch(EWZ_SHARES_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestimentosPainel/1.0)" } }),
]);
if (!b3Response.ok) throw new Error(`Fonte B3 indisponível (${b3Response.status}).`);
if (!ewzSharesResponse.ok) throw new Error(`Fonte EWZ indisponível (${ewzSharesResponse.status}).`);

const b3Rows = parseB3Rows(await b3Response.text());
if (b3Rows.length === 0) throw new Error("A fonte B3 não devolveu pregões no intervalo solicitado.");
const ewzSharesByDate = parseEwzShares(await ewzSharesResponse.text());
const ewzPricesByDate = parseEwzPrices();

let previousShares = null;
const ewzByDate = new Map();
for (const date of [...ewzSharesByDate.keys()].sort()) {
  const shares = ewzSharesByDate.get(date);
  const close = ewzPricesByDate.get(date) ?? null;
  const shareChange = previousShares === null ? null : shares - previousShares;
  const flowProxy = shareChange !== null && close !== null ? shareChange * close : null;
  ewzByDate.set(date, { shares, close, shareChange, flowProxy });
  previousShares = shares;
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [owners] = await connection.execute(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
  );
  if (owners.length !== 1) throw new Error("Administrador do painel não encontrado.");
  const userId = owners[0].id;

  await connection.beginTransaction();
  const insertSql = `
    INSERT INTO market_flow_snapshots (
      userId, snapshotDate, b3_reported_through, b3_sessions, b3_foreign_flow_brl, b3_domestic_flow_brl,
      ewz_shares_outstanding, ewz_net_assets_usd, ewz_nav_usd, ewz_shares_change, ewz_flow_proxy_usd,
      source_b3, source_ewz
    ) VALUES (?, ?, ?, 1, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      b3_reported_through = VALUES(b3_reported_through),
      b3_sessions = VALUES(b3_sessions),
      b3_foreign_flow_brl = VALUES(b3_foreign_flow_brl),
      b3_domestic_flow_brl = VALUES(b3_domestic_flow_brl),
      ewz_shares_outstanding = VALUES(ewz_shares_outstanding),
      ewz_net_assets_usd = VALUES(ewz_net_assets_usd),
      ewz_nav_usd = VALUES(ewz_nav_usd),
      ewz_shares_change = VALUES(ewz_shares_change),
      ewz_flow_proxy_usd = VALUES(ewz_flow_proxy_usd),
      source_b3 = VALUES(source_b3),
      source_ewz = VALUES(source_ewz)
  `;

  for (const row of b3Rows) {
    const ewz = ewzByDate.get(row.date);
    await connection.execute(insertSql, [
      userId,
      row.date,
      row.date,
      row.foreignBrl.toFixed(2),
      row.domesticBrl.toFixed(2),
      ewz ? ewz.shares.toFixed(2) : null,
      ewz?.close ? ewz.close.toFixed(4) : null,
      ewz?.shareChange === null || ewz === undefined ? null : ewz.shareChange.toFixed(2),
      ewz?.flowProxy === null || ewz === undefined ? null : ewz.flowProxy.toFixed(2),
      "B3 via Dados de Mercado — série diária divulgada com defasagem; valores em BRL.",
      ewz
        ? "EWZ: cotas históricas via CompaniesMarketCap (atribuídas à iShares) × fechamento EWZ via Yahoo Finance; proxy em USD, não somar à B3."
        : "EWZ: indisponível para a data na série histórica; não estimado.",
    ]);
  }

  await connection.commit();
  const withEwz = b3Rows.filter((row) => ewzByDate.has(row.date)).length;
  console.log(JSON.stringify({
    userId,
    startDate: START_DATE,
    endDate: END_DATE,
    b3SnapshotsUpserted: b3Rows.length,
    ewzProxyRows: withEwz,
    firstB3Date: b3Rows[0].date,
    lastB3Date: b3Rows.at(-1).date,
    methodology: "B3 diário por perfil; EWZ = variação de cotas × fechamento em USD.",
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
