import { and, eq, gte, lt } from "drizzle-orm";
import { dailyPerformanceSnapshots, dividends, transactions } from "../../drizzle/schema";
import { getAssetsByUser, getDb } from "../db";
import {
  fetchHistoricalCloses,
  fetchHistoricalUsdBrlCloses,
  fetchQuotes,
  fetchUsdBrlQuote,
} from "../quotes";

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

export type DailyPerformanceResult = {
  date: string;
  totalPct: number;
  totalBRL: number;
  marketPnlBRL: number;
  incomePnlBRL: number;
  totalValueBRL: number;
  startValueBRL: number;
  byClass: DailyClassResult[];
  byTicker: Record<string, { changeBRL: number; changePct: number }>;
  updatedAt: Date;
  excludesCash: true;
};

export type MonthlyPerformanceResult = {
  total: { valueDiff: number; percentDiff: number };
  byClass: Record<string, { valueDiff: number; percentDiff: number }>;
  snapshotCount: number;
  baseDate: string;
  includesLiveDay: boolean;
  isPartial: boolean;
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
};

export function calculateMonthlyReturn(
  points: MonthlyPoint[],
  monthStart: string,
  includesLiveDay: boolean
): MonthlyPerformanceResult | null {
  if (points.length === 0) return null;
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
    baseDate: points[0].date,
    includesLiveDay,
    isPartial: points[0].date !== monthStart,
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
  const [userAssets, dayTransactions, paidDividends, fxQuote] = await Promise.all([
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
      .reduce((sum, transaction) => sum + numberOrZero(transaction.totalValue), 0);
    const sellProceeds = assetTransactions
      .filter((transaction) => transaction.type === "sell")
      .reduce((sum, transaction) => sum + Math.max(0, numberOrZero(transaction.totalValue) - numberOrZero(transaction.fees)), 0);
    const income = (dividendsByAsset.get(asset.id) ?? [])
      .reduce((sum, dividend) => sum + toBrl(
        numberOrZero(dividend.totalValue),
        dividend.currency,
        fxQuote.price
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
      currentFx: fxQuote.price,
      previousFx: fxQuote.previousClose,
    });
    byTicker[asset.ticker] = {
      changeBRL: result.changeBRL,
      changePct: result.startValueBRL > 0 ? (result.changeBRL / result.startValueBRL) * 100 : 0,
    };

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
    byTicker,
    updatedAt: new Date(),
    excludesCash: true,
  };
}

/**
 * Reconstrói retornos de dias úteis ainda sem fechamento persistido. Isso cobre os
 * primeiros dias de um mês após a implantação do ledger, sem criar ativos ou
 * transações; os fechamentos automáticos passam a substituir esse fallback.
 */
async function reconstructHistoricalDailyPoints(
  userId: number,
  dates: string[],
  monthStart: string
): Promise<MonthlyPoint[]> {
  if (dates.length === 0) return [];
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const { start: monthStartAt } = dayBounds(monthStart);
  const [userAssets, monthTransactions, monthDividends] = await Promise.all([
    getAssetsByUser(userId),
    db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.transactionDate, monthStartAt))),
    db.select().from(dividends).where(and(eq(dividends.userId, userId), gte(dividends.paymentDate, monthStartAt))),
  ]);
  const investedAssets = userAssets.filter((asset) => asset.assetClass !== "caixa");
  const [historicalQuotes, historicalFx] = await Promise.all([
    fetchHistoricalCloses(
      investedAssets
        .filter((asset) => asset.assetClass !== "renda_fixa")
        .map((asset) => ({ ticker: asset.ticker, assetClass: asset.assetClass }))
    ),
    fetchHistoricalUsdBrlCloses(),
  ]);

  return dates.map((date) => {
    const { start, next } = dayBounds(date);
    const classes = new Map<string, Omit<DailyClassResult, "classKey" | "className" | "changePct">>();

    for (const asset of investedAssets) {
      const currency = asset.currency || CLASS_CURRENCY[asset.assetClass] || "BRL";
      const assetTransactions = monthTransactions.filter((transaction) => transaction.assetId === asset.id);
      const dayTransactions = assetTransactions.filter((transaction) => transaction.transactionDate >= start && transaction.transactionDate < next);
      const futureTransactions = assetTransactions.filter((transaction) => transaction.transactionDate >= next);
      const futureBuys = futureTransactions
        .filter((transaction) => transaction.type === "buy")
        .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
      const futureSells = futureTransactions
        .filter((transaction) => transaction.type === "sell")
        .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
      const endQty = Math.max(0, numberOrZero(asset.totalQuantity) - futureBuys + futureSells);
      const buyQty = dayTransactions
        .filter((transaction) => transaction.type === "buy")
        .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
      const sellQty = dayTransactions
        .filter((transaction) => transaction.type === "sell")
        .reduce((sum, transaction) => sum + numberOrZero(transaction.quantity), 0);
      const buyCost = dayTransactions
        .filter((transaction) => transaction.type === "buy")
        .reduce((sum, transaction) => sum + numberOrZero(transaction.totalValue), 0);
      const sellProceeds = dayTransactions
        .filter((transaction) => transaction.type === "sell")
        .reduce((sum, transaction) => sum + Math.max(0, numberOrZero(transaction.totalValue) - numberOrZero(transaction.fees)), 0);
      const income = monthDividends
        .filter((dividend) => dividend.assetId === asset.id && dividend.paymentDate && dividend.paymentDate >= start && dividend.paymentDate < next)
        .reduce((sum, dividend) => sum + toBrl(numberOrZero(dividend.totalValue), dividend.currency, historicalCloseAt(historicalFx.closesByDate, date, 1)), 0);
      const fallbackPrice = numberOrZero(asset.lastPrice);
      const priceSeries = historicalQuotes.get(asset.ticker)?.closesByDate;
      const currentPrice = historicalCloseAt(priceSeries, date, fallbackPrice);
      const previousPrice = historicalCloseAt(priceSeries, previousCalendarDate(date), currentPrice);
      const currentFx = historicalCloseAt(historicalFx.closesByDate, date, 5.5);
      const previousFx = historicalCloseAt(historicalFx.closesByDate, previousCalendarDate(date), currentFx);
      const result = calculateAssetDayReturn({
        currentQty: endQty,
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
    }));
    const startValue = byClass.reduce((sum, item) => sum + item.startValueBRL, 0);
    const returnValue = byClass.reduce((sum, item) => sum + item.changeBRL, 0);
    return {
      date,
      returnPct: startValue > 0 ? (returnValue / startValue) * 100 : 0,
      returnValue,
      byClass,
    };
  });
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
  };
  const existing = await db.select().from(dailyPerformanceSnapshots).where(and(
    eq(dailyPerformanceSnapshots.userId, userId),
    eq(dailyPerformanceSnapshots.snapshotDate, performance.date),
  )).limit(1);

  if (existing.length > 0) {
    await db.update(dailyPerformanceSnapshots).set(values).where(eq(dailyPerformanceSnapshots.id, existing[0].id));
  } else {
    await db.insert(dailyPerformanceSnapshots).values({ userId, snapshotDate: performance.date, ...values });
  }
  return { ...performance, updated: existing.length > 0 };
}

/** Encadeia retornos fechados do mês e inclui o retorno intradiário até o próximo fechamento. */
export async function getMonthlyPerformance(userId: number): Promise<MonthlyPerformanceResult | null> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const today = brtDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const stored = await db.select().from(dailyPerformanceSnapshots).where(and(
    eq(dailyPerformanceSnapshots.userId, userId),
    gte(dailyPerformanceSnapshots.snapshotDate, monthStart),
    lt(dailyPerformanceSnapshots.snapshotDate, `${today.slice(0, 7)}-32`),
  )).orderBy(dailyPerformanceSnapshots.snapshotDate);

  const points = stored.map((row) => ({
    date: row.snapshotDate,
    returnPct: numberOrZero(row.returnPct),
    returnValue: numberOrZero(row.returnValue),
    byClass: row.classBreakdown ? JSON.parse(row.classBreakdown) as DailyClassResult[] : [],
  }));
  const storedDates = new Set(points.map((point) => point.date));
  const previousBusinessDates = calendarDates(monthStart, previousCalendarDate(today));
  const missingDates = previousBusinessDates.filter((date) => !storedDates.has(date));
  const reconstructed = await reconstructHistoricalDailyPoints(userId, missingDates, monthStart);
  points.push(...reconstructed);
  points.sort((left, right) => left.date.localeCompare(right.date));

  let includesLiveDay = false;
  if (!points.some((point) => point.date === today)) {
    const live = await getLiveDailyPerformance(userId, today);
    points.push({ date: today, returnPct: live.totalPct, returnValue: live.totalBRL, byClass: live.byClass });
    includesLiveDay = true;
  }
  return calculateMonthlyReturn(points, monthStart, includesLiveDay);
}

export const dailyPerformanceInternals = {
  brtDate,
  dayBounds,
  calendarDates,
  historicalCloseAt,
  numberOrZero,
  toBrl,
};
