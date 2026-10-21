import { and, eq, gte, lt } from "drizzle-orm";
import { dailyPerformanceSnapshots, dividends, transactions } from "../../drizzle/schema";
import { getAssetsByUser, getDb } from "../db";
import {
  fetchQuotes,
  fetchUsdBrlQuote,
} from "../quotes";
import { resolveValuationFxRateForUser } from "./valuationFxService";

const BRT_TIME_ZONE = "America/Sao_Paulo";

type DailyClassResult = {
  classKey: string;
  className: string;
  startValueBRL: number;
  valueBRL: number;
  marketPnlBRL: number;
  incomePnlBRL: number;
  changeBRL: number;
  changePct: number;
};

export type DailyAssetResult = {
  assetId: number;
  ticker: string;
  name: string;
  classKey: string;
  currency: "BRL" | "USD";
  startValueBRL: number;
  valueBRL: number;
  marketPnlBRL: number;
  incomePnlBRL: number;
  changeBRL: number;
  changePct: number;
};

export type DailyPerformanceResult = {
  date: string;
  totalPct: number;
  totalBRL: number;
  marketPnlBRL: number;
  incomePnlBRL: number;
  totalValueBRL: number;
  startValueBRL: number;
  byClass: DailyClassResult[];
  byAsset: DailyAssetResult[];
  byTicker: Record<string, { changeBRL: number; changePct: number }>;
  updatedAt: Date;
  excludesCash: true;
  fxRate: number;
  fxSource: "conciliacao" | "mercado";
};

export type MonthlyPerformanceResult = {
  total: { valueDiff: number; percentDiff: number };
  byClass: Record<string, { valueDiff: number; percentDiff: number }>;
  snapshotCount: number;
  closedSnapshotCount: number;
  baseDate: string;
  includesLiveDay: boolean;
  isPartial: boolean;
  lastClosedDate: string;
  missingClosedDates: string[];
  hasClosedGaps: boolean;
};

const CLASS_CURRENCY: Record<string, "BRL" | "USD"> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
};

const ASSET_CLASS_LABELS: Record<string, string> = {
  rv_nacional: "RV Nacional",
  rv_eua: "RV EUA",
  fundos: "Fundos",
  cripto: "Criptomoedas",
  renda_fixa: "Renda Fixa",
  uranio: "Urânio",
  india: "Índia",
};

function brtDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00-03:00`);
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, next };
}

function calendarDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (
    let current = new Date(`${startDate}T12:00:00-03:00`), end = new Date(`${endDate}T12:00:00-03:00`);
    current <= end;
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const weekday = current.getDay();
    if (weekday !== 0 && weekday !== 6) dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function previousCalendarDate(date: string): string {
  const current = new Date(`${date}T12:00:00-03:00`);
  current.setDate(current.getDate() - 1);
  return current.toISOString().slice(0, 10);
}

function historicalCloseAt(series: Map<string, number> | undefined, date: string, fallback: number): number {
  if (!series || series.size === 0) return fallback;
  const direct = series.get(date);
  if (direct && direct > 0) return direct;
  const prior = Array.from(series.entries())
    .filter(([entryDate, close]) => entryDate <= date && close > 0)
    .sort(([left], [right]) => right.localeCompare(left))[0]?.[1];
  return prior ?? fallback;
}

function numberOrZero(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function toBrl(value: number, currency: "BRL" | "USD", fx: number): number {
  return currency === "USD" ? value * fx : value;
}

export type AssetDayReturnInput = {
  currentQty: number;
  buyQty: number;
  sellQty: number;
  currentPrice: number;
  previousPrice: number;
  buyCost: number;
  sellProceeds: number;
  income: number;
  currency: "BRL" | "USD";
  currentFx: number;
  previousFx: number;
};

export function calculateAssetDayReturn(input: AssetDayReturnInput) {
  const startQty = Math.max(0, input.currentQty - input.buyQty + input.sellQty);
  const startValueBRL = startQty * toBrl(input.previousPrice, input.currency, input.previousFx);
  const valueBRL = input.currentQty * toBrl(input.currentPrice, input.currency, input.currentFx);
  const marketPnlBRL = valueBRL
    - startValueBRL
    - toBrl(input.buyCost, input.currency, input.currentFx)
    + toBrl(input.sellProceeds, input.currency, input.currentFx);
  return {
    startValueBRL,
    valueBRL,
    marketPnlBRL,
    incomePnlBRL: input.income,
    changeBRL: marketPnlBRL + input.income,
  };
}

type MonthlyPoint = {
  date: string;
  returnPct: number;
  returnValue: number;
  byClass: DailyClassResult[];
  byAsset?: DailyAssetResult[];
  source?: "ledger" | "live";
};

export function calculateMonthlyReturn(
  points: MonthlyPoint[],
  monthStart: string,
  includesLiveDay: boolean
): MonthlyPerformanceResult | null {
  if (points.length === 0) return null;
  const closedPoints = points.filter((point) => point.source !== "live");
  const lastClosedDate = closedPoints.at(-1)?.date ?? points.at(-1)?.date ?? points[0].date;
  const closedDates = new Set(closedPoints.map((point) => point.date));
  const missingClosedDates = closedPoints.length > 0
    ? calendarDates(monthStart, lastClosedDate).filter((date) => !closedDates.has(date))
    : [];
  let compounded = 1;
  let valueDiff = 0;
  const classes = new Map<string, { compounded: number; valueDiff: number }>();
  for (const point of points) {
    compounded *= 1 + point.returnPct / 100;
    valueDiff += point.returnValue;
    for (const item of point.byClass) {
      const current = classes.get(item.classKey) ?? { compounded: 1, valueDiff: 0 };
      current.compounded *= 1 + item.changePct / 100;
      current.valueDiff += item.changeBRL;
      classes.set(item.classKey, current);
    }
  }
  const byClass = Object.fromEntries(Array.from(classes.entries()).map(([classKey, result]) => [
    classKey,
    { valueDiff: result.valueDiff, percentDiff: (result.compounded - 1) * 100 },
  ]));
  return {
    total: { valueDiff, percentDiff: (compounded - 1) * 100 },
    byClass,
    snapshotCount: points.length,
    closedSnapshotCount: closedPoints.length,
    baseDate: points[0].date,
    includesLiveDay,
    isPartial: points[0].date !== monthStart,
    lastClosedDate,
    missingClosedDates,
    hasClosedGaps: missingClosedDates.length > 0,
  };
}

/**
 * Retorno diário em BRL da carteira investida, sem caixa conciliado.
 * A fórmula elimina compras e vendas do dia e soma os proventos pagos no dia:
 * fim - início - compras líquidas + vendas líquidas + proventos.
 */
export async function getLiveDailyPerformance(
  userId: number,
  referenceDate = brtDate()
): Promise<DailyPerformanceResult> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const { start, next } = dayBounds(referenceDate);
  const [userAssets, dayTransactions, paidDividends, marketFxQuote] = await Promise.all([
    getAssetsByUser(userId),
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      gte(transactions.transactionDate, start),
      lt(transactions.transactionDate, next),
    )),
    db.select().from(dividends).where(and(
      eq(dividends.userId, userId),
      gte(dividends.paymentDate, start),
      lt(dividends.paymentDate, next),
    )),
    fetchUsdBrlQuote(),
  ]);
  const fxResolution = await resolveValuationFxRateForUser(userId, marketFxQuote.price);
  const currentFx = fxResolution.rate;
  const previousFx = fxResolution.source === "conciliacao" ? currentFx : marketFxQuote.previousClose;

  const investedAssets = userAssets.filter((asset) => asset.assetClass !== "caixa");
  const quotes = await fetchQuotes(
    investedAssets
      .filter((asset) => asset.assetClass !== "renda_fixa")
      .map((asset) => ({ ticker: asset.ticker, assetClass: asset.assetClass }))
  ).catch(() => new Map());

  const transactionsByAsset = new Map<number, typeof dayTransactions>();
  for (const transaction of dayTransactions) {
    const items = transactionsByAsset.get(transaction.assetId) ?? [];
    items.push(transaction);
    transactionsByAsset.set(transaction.assetId, items);
  }
  const dividendsByAsset = new Map<number, typeof paidDividends>();
  for (const dividend of paidDividends) {
    const items = dividendsByAsset.get(dividend.assetId) ?? [];
    items.push(dividend);
    dividendsByAsset.set(dividend.assetId, items);
  }

  const classes = new Map<string, Omit<DailyClassResult, "classKey" | "className" | "changePct">>();
  const byAsset: DailyAssetResult[] = [];
  const byTicker: Record<string, { changeBRL: number; changePct: number }> = {};
  for (const asset of investedAssets) {
    const currency = asset.currency || CLASS_CURRENCY[asset.assetClass] || "BRL";
    const quote = quotes.get(asset.ticker);
    const currentPrice = quote?.price && quote.price > 0 ? quote.price : numberOrZero(asset.lastPrice);
    const previousPrice = quote ? Math.max(0, quote.price - quote.change) : currentPrice;
    const currentQty = numberOrZero(asset.totalQuantity);
    const assetTransactions = transactionsByAsset.get(asset.id) ?? [];
    const buyQty = assetTransactions
      .filter((transaction) => transaction.type === "buy")
      .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
    const sellQty = assetTransactions
      .filter((transaction) => transaction.type === "sell")
      .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
    const buyCost = assetTransactions
      .filter((transaction) => transaction.type === "buy")
      .reduce((sum, transaction) => sum + numberOrZero(transaction.totalValue) + numberOrZero(transaction.fees), 0);
    const sellProceeds = assetTransactions
      .filter((transaction) => transaction.type === "sell")
      .reduce((sum, transaction) => sum + Math.max(0, numberOrZero(transaction.totalValue) - numberOrZero(transaction.fees)), 0);
    const income = (dividendsByAsset.get(asset.id) ?? [])
      .reduce((sum, dividend) => sum + toBrl(
        numberOrZero(dividend.totalValue),
        dividend.currency,
        currentFx
      ), 0);

    const result = calculateAssetDayReturn({
      currentQty,
      buyQty,
      sellQty,
      currentPrice,
      previousPrice,
      buyCost,
      sellProceeds,
      income,
      currency,
      currentFx,
      previousFx,
    });
    byTicker[asset.ticker] = {
      changeBRL: result.changeBRL,
      changePct: result.startValueBRL > 0 ? (result.changeBRL / result.startValueBRL) * 100 : 0,
    };
    byAsset.push({
      assetId: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      classKey: asset.assetClass,
      currency,
      ...result,
      changePct: result.startValueBRL > 0 ? (result.changeBRL / result.startValueBRL) * 100 : 0,
    });

    const current = classes.get(asset.assetClass) ?? {
      startValueBRL: 0,
      valueBRL: 0,
      marketPnlBRL: 0,
      incomePnlBRL: 0,
      changeBRL: 0,
    };
    current.startValueBRL += result.startValueBRL;
    current.valueBRL += result.valueBRL;
    current.marketPnlBRL += result.marketPnlBRL;
    current.incomePnlBRL += result.incomePnlBRL;
    current.changeBRL += result.changeBRL;
    classes.set(asset.assetClass, current);
  }

  const byClass = Array.from(classes.entries()).map(([classKey, result]) => ({
    classKey,
    className: ASSET_CLASS_LABELS[classKey] || classKey,
    ...result,
    changePct: result.startValueBRL > 0 ? (result.changeBRL / result.startValueBRL) * 100 : 0,
  })).sort((a, b) => Math.abs(b.changeBRL) - Math.abs(a.changeBRL));

  const startValueBRL = byClass.reduce((sum, item) => sum + item.startValueBRL, 0);
  const totalValueBRL = byClass.reduce((sum, item) => sum + item.valueBRL, 0);
  const marketPnlBRL = byClass.reduce((sum, item) => sum + item.marketPnlBRL, 0);
  const incomePnlBRL = byClass.reduce((sum, item) => sum + item.incomePnlBRL, 0);
  const totalBRL = marketPnlBRL + incomePnlBRL;

  return {
    date: referenceDate,
    totalPct: startValueBRL > 0 ? (totalBRL / startValueBRL) * 100 : 0,
    totalBRL,
    marketPnlBRL,
    incomePnlBRL,
    totalValueBRL,
    startValueBRL,
    byClass,
    byAsset,
    byTicker,
    updatedAt: new Date(),
    excludesCash: true,
    fxRate: currentFx,
    fxSource: fxResolution.source,
  };
}

/** Persiste ou atualiza o retorno de uma data, mantendo a operação idempotente. */
export async function captureDailyPerformanceSnapshot(userId: number) {
  const performance = await getLiveDailyPerformance(userId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const values = {
    startValue: performance.startValueBRL.toFixed(2),
    endValue: performance.totalValueBRL.toFixed(2),
    marketPnl: performance.marketPnlBRL.toFixed(2),
    incomePnl: performance.incomePnlBRL.toFixed(2),
    returnValue: performance.totalBRL.toFixed(2),
    returnPct: performance.totalPct.toFixed(8),
    classBreakdown: JSON.stringify(performance.byClass),
    assetBreakdown: JSON.stringify(performance.byAsset),
    capturedAt: new Date(),
    valuationAsOf: performance.updatedAt,
    status: "final" as const,
    fxRate: performance.fxRate.toFixed(4),
    fxSource: performance.fxSource,
  };
  const existing = await db.select().from(dailyPerformanceSnapshots).where(and(
    eq(dailyPerformanceSnapshots.userId, userId),
    eq(dailyPerformanceSnapshots.snapshotDate, performance.date),
  )).limit(1);

  await db.insert(dailyPerformanceSnapshots).values({ userId, snapshotDate: performance.date, ...values })
    .onDuplicateKeyUpdate({ set: values });
  return { ...performance, updated: existing.length > 0 };
}

async function getMonthlyPerformancePoints(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const today = brtDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const stored = await db.select().from(dailyPerformanceSnapshots).where(and(
    eq(dailyPerformanceSnapshots.userId, userId),
    gte(dailyPerformanceSnapshots.snapshotDate, monthStart),
    lt(dailyPerformanceSnapshots.snapshotDate, `${today.slice(0, 7)}-32`),
  )).orderBy(dailyPerformanceSnapshots.snapshotDate);

  const points: MonthlyPoint[] = stored.map((row) => ({
    date: row.snapshotDate,
    returnPct: numberOrZero(row.returnPct),
    returnValue: numberOrZero(row.returnValue),
    byClass: row.classBreakdown ? JSON.parse(row.classBreakdown) as DailyClassResult[] : [],
    byAsset: row.assetBreakdown ? JSON.parse(row.assetBreakdown) as DailyAssetResult[] : [],
    source: "ledger",
  }));

  let includesLiveDay = false;
  if (!points.some((point) => point.date === today)) {
    const live = await getLiveDailyPerformance(userId, today);
    points.push({
      date: today,
      returnPct: live.totalPct,
      returnValue: live.totalBRL,
      byClass: live.byClass,
      byAsset: live.byAsset,
      source: "live",
    });
    includesLiveDay = true;
  }
  points.sort((left, right) => left.date.localeCompare(right.date));
  return { monthStart, today, includesLiveDay, points };
}

/** Encadeia retornos fechados do mês e inclui o retorno intradiário até o próximo fechamento. */
export async function getMonthlyPerformance(userId: number): Promise<MonthlyPerformanceResult | null> {
  const { monthStart, includesLiveDay, points } = await getMonthlyPerformancePoints(userId);
  const result = calculateMonthlyReturn(points, monthStart, includesLiveDay);
  if (!result) return null;
  return { ...result, lastClosedDate: points.filter((point) => point.source === "ledger").at(-1)?.date ?? result.baseDate };
}

/** Retorna a auditoria mensal por dia e por ativo sem modificar a carteira. */
export async function getMonthlyPerformanceDetails(userId: number) {
  const { monthStart, today, includesLiveDay, points } = await getMonthlyPerformancePoints(userId);
  const days = points.map((point) => ({ ...point, byAsset: point.byAsset ?? [] }));
  return {
    monthStart,
    today,
    includesLiveDay,
    summary: await getMonthlyPerformance(userId),
    days,
  };
}

export const dailyPerformanceInternals = {
  brtDate,
  dayBounds,
  calendarDates,
  historicalCloseAt,
  numberOrZero,
  toBrl,
};
