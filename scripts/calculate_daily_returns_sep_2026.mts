import { and, eq, gte, lt } from "drizzle-orm";
import { assets as assetsTable, transactions as transactionsTable } from "../drizzle/schema";
import { getAssetsByUser, getDb } from "../server/db";
import { fetchQuotes, fetchUsdBrl } from "../server/quotes";
import { callDataApi } from "../server/_core/dataApi";
import { writeFile } from "node:fs/promises";

type ChartPoint = { close: number; date: string };

const USER_ID = 1;
const SEP_1 = "2026-09-01";
const SEP_2 = "2026-09-02";
const AUG_31 = "2026-08-31";
const AUG_30 = "2026-08-30";

function yahooSymbol(ticker: string, assetClass: string): string | null {
  if (["caixa", "renda_fixa", "fundos"].includes(assetClass)) return null;
  const crypto: Record<string, string> = {
    BTC: "BTC-USD", BTC_BIN: "BTC-USD", ETH: "ETH-USD", ETH_BIN: "ETH-USD",
    SOL: "SOL-USD", SOL_BIN: "SOL-USD", BNB: "BNB-USD", AVAX: "AVAX-USD",
  };
  if (crypto[ticker]) return crypto[ticker];
  if (assetClass === "rv_nacional") return /^\w+\d+$/.test(ticker) ? `${ticker}.SA` : null;
  if (["rv_eua", "uranio", "india"].includes(assetClass)) return ticker === "NVIDIA" ? "NVDA" : ticker;
  return null;
}

function toBrtDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp * 1000));
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

async function chart(symbol: string): Promise<ChartPoint[]> {
  const result = await callDataApi("YahooFinance/get_stock_chart", {
    query: {
      symbol, region: symbol.endsWith(".SA") ? "BR" : "US", interval: "1d", range: "5d",
      includeAdjustedClose: "true", events: "div,split",
    },
  }) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } };

  const payload = result.chart?.result?.[0];
  const timestamps = payload?.timestamp ?? [];
  const closes = payload?.indicators?.quote?.[0]?.close ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return typeof close === "number" && Number.isFinite(close) ? [{ date: toBrtDate(timestamp), close }] : [];
  });
}

async function collectHistoricalPrices(symbols: string[]) {
  const results = new Map<string, ChartPoint[]>();
  const failures: string[] = [];
  const chunkSize = 8;
  for (let index = 0; index < symbols.length; index += chunkSize) {
    const chunk = symbols.slice(index, index + chunkSize);
    const settled = await Promise.allSettled(chunk.map(async (symbol) => ({ symbol, points: await chart(symbol) })));
    for (const item of settled) {
      if (item.status === "fulfilled") results.set(item.value.symbol, item.value.points);
      else failures.push(item.reason instanceof Error ? item.reason.message : "Falha sem detalhe");
    }
    if (index + chunkSize < symbols.length) await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return { results, failures };
}

function closeOn(points: ChartPoint[] | undefined, date: string) {
  return points?.find((point) => point.date === date)?.close ?? null;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível.");

  const [assets, transactions, currentUsdBrl] = await Promise.all([
    getAssetsByUser(USER_ID),
    db.select({
      assetId: transactionsTable.assetId,
      type: transactionsTable.type,
      quantity: transactionsTable.quantity,
      transactionDate: transactionsTable.transactionDate,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.userId, USER_ID),
      gte(transactionsTable.transactionDate, new Date("2026-09-01T00:00:00-03:00")),
      lt(transactionsTable.transactionDate, new Date("2026-09-03T00:00:00-03:00")),
    )),
    fetchUsdBrl(),
  ]);

  const activeAssets = assets.filter((asset) => asset.assetClass !== "caixa");
  const symbolByAssetId = new Map<number, string>();
  const uniqueSymbols = new Set<string>();
  for (const asset of activeAssets) {
    const symbol = yahooSymbol(asset.ticker, asset.assetClass);
    if (symbol) {
      symbolByAssetId.set(asset.id, symbol);
      uniqueSymbols.add(symbol);
    }
  }
  uniqueSymbols.add("USDBRL=X");

  const [{ results: historical, failures }, liveQuotes] = await Promise.all([
    collectHistoricalPrices([...uniqueSymbols]),
    fetchQuotes(activeAssets.map((asset) => ({ ticker: asset.ticker, assetClass: asset.assetClass }))),
  ]);

  // O Yahoo publica a série de FX no início do dia UTC; convertida para
  // America/Sao_Paulo, cada ponto passa a carregar a data civil anterior.
  const fxAug31 = closeOn(historical.get("USDBRL=X"), AUG_30);
  const fxSep1 = closeOn(historical.get("USDBRL=X"), AUG_31);
  if (!fxAug31 || !fxSep1) {
    await writeFile("/home/ubuntu/investimentos-painel/.tmp_daily_returns_market_debug.json", JSON.stringify({
      usdBrlPoints: historical.get("USDBRL=X") ?? [],
      symbolsCollected: [...historical.keys()],
      failures,
    }, null, 2));
    throw new Error("Não foi possível obter as referências USD/BRL de 31/08 e 01/09.");
  }

  const quantitiesAt = (assetId: number, beforeDate: string) => {
    let quantity = Number(activeAssets.find((asset) => asset.id === assetId)?.totalQuantity ?? 0);
    for (const transaction of transactions) {
      const txDate = transaction.transactionDate.toISOString().slice(0, 10);
      if (transaction.assetId === assetId && txDate >= beforeDate) {
        const signed = transaction.type === "buy" ? Number(transaction.quantity) : -Number(transaction.quantity);
        quantity -= signed;
      }
    }
    return quantity;
  };

  const rows = activeAssets.map((asset) => {
    const currency = asset.currency;
    const symbol = symbolByAssetId.get(asset.id);
    const historicalPoints = symbol ? historical.get(symbol) : undefined;
    const aug31 = closeOn(historicalPoints, AUG_31) ?? Number(asset.lastPrice);
    const sep1 = closeOn(historicalPoints, SEP_1) ?? aug31;
    const livePrice = liveQuotes.get(asset.ticker)?.price ?? Number(asset.lastPrice);
    const qtyAug31 = quantitiesAt(asset.id, SEP_1);
    const qtySep1 = quantitiesAt(asset.id, SEP_2);
    const toBrl = (price: number, fx: number) => currency === "USD" ? price * fx : price;
    const pnlSep1 = qtyAug31 * (toBrl(sep1, fxSep1) - toBrl(aug31, fxAug31));
    const pnlSep2 = qtySep1 * (toBrl(livePrice, currentUsdBrl) - toBrl(sep1, fxSep1));
    const startSep2Value = qtySep1 * toBrl(sep1, fxSep1);
    return {
      ticker: asset.ticker, assetClass: asset.assetClass, currency, symbol: symbol ?? null,
      qtyAug31, qtySep1, aug31, sep1, livePrice, pnlSep1, pnlSep2, startSep2Value,
      usedFallback: !symbol || !closeOn(historicalPoints, AUG_31) || !closeOn(historicalPoints, SEP_1),
    };
  });

  const sum = (field: "pnlSep1" | "pnlSep2" | "startSep2Value") => rows.reduce((total, row) => total + row[field], 0);
  const aug31Snapshot = 1876214.54;
  const result = {
    asOf: new Date().toISOString(),
    methodology: "Variação a mercado dos ativos já detidos no início de cada dia; compras do próprio dia são excluídas da variação para não tratar aporte/reinvestimento como ganho.",
    fx: { aug31: fxAug31, sep1: fxSep1, current: currentUsdBrl },
    sep1: { marketPnlBRL: sum("pnlSep1"), baseBRL: aug31Snapshot, returnPct: (sum("pnlSep1") / aug31Snapshot) * 100 },
    sep2: { marketPnlBRL: sum("pnlSep2"), baseBRL: sum("startSep2Value"), returnPct: (sum("pnlSep2") / sum("startSep2Value")) * 100 },
    coverage: {
      assets: rows.length,
      fallbackAssets: rows.filter((row) => row.usedFallback).map((row) => row.ticker),
      apiFailures: failures.length,
    },
    byClass: Object.values(rows.reduce<Record<string, { pnlSep1: number; pnlSep2: number }>>((acc, row) => {
      const classRow = acc[row.assetClass] ?? { pnlSep1: 0, pnlSep2: 0 };
      classRow.pnlSep1 += row.pnlSep1;
      classRow.pnlSep2 += row.pnlSep2;
      acc[row.assetClass] = classRow;
      return acc;
    }, {})),
    topContributors: {
      sep1: [...rows].sort((a, b) => Math.abs(b.pnlSep1) - Math.abs(a.pnlSep1)).slice(0, 8),
      sep2: [...rows].sort((a, b) => Math.abs(b.pnlSep2) - Math.abs(a.pnlSep2)).slice(0, 8),
    },
  };

  await writeFile("/home/ubuntu/investimentos-painel/.tmp_daily_returns_sep_2026.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ sep1: result.sep1, sep2: result.sep2, coverage: result.coverage }, null, 2));
}

await main();
