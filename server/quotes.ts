import axios from "axios";
import { DEFAULT_USD_BRL_RATE } from "../shared/constants";

interface QuoteResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
}

export interface FxQuote {
  price: number;
  change: number;
  previousClose: number;
}

export interface HistoricalCloseSeries {
  closesByDate: Map<string, number>;
}

/**
 * Converte ticker do formato interno para o formato Yahoo Finance
 */
function toYahooTicker(ticker: string, assetClass: string): string | null {
  // Caixa e renda fixa não têm cotação de mercado
  if (["caixa", "renda_fixa"].includes(assetClass)) return null;

  // Cripto
  const cryptoMap: Record<string, string> = {
    BTC: "BTC-USD",
    BTC_BIN: "BTC-USD",
    ETH: "ETH-USD",
    ETH_BIN: "ETH-USD",
    SOL: "SOL-USD",
    SOL_BIN: "SOL-USD",
    BNB: "BNB-USD",
    AVAX: "AVAX-USD",
  };
  if (cryptoMap[ticker]) return cryptoMap[ticker];

  // Ações e FIIs brasileiros (rv_nacional e fundos)
  // Tickers terminam em dígitos (ex: VALE3, ZAVI11, XPML11)
  if (assetClass === "rv_nacional" || assetClass === "fundos") {
    if (/^\w+\d+$/.test(ticker)) return `${ticker}.SA`;
    return null;
  }

  // Urânio e Índia - ETFs e ADRs americanos
  if (["uranio", "india", "rv_eua"].includes(assetClass)) {
    // NVIDIA ticker fix
    if (ticker === "NVIDIA") return "NVDA";
    if (ticker === "NET") return "NET";
    return ticker;
  }

  return ticker;
}

function brtDateFromTimestamp(timestampSeconds: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampSeconds * 1000));
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

async function fetchYahooHistoricalCloses(yahooTicker: string, range: string): Promise<HistoricalCloseSeries> {
  const response = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=${range}`,
    { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  const chart = response.data?.chart?.result?.[0];
  const timestamps: number[] = chart?.timestamp ?? [];
  const closes: Array<number | null> = chart?.indicators?.quote?.[0]?.close ?? [];
  const closesByDate = new Map<string, number>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = Number(closes[index]);
    if (Number.isFinite(close) && close > 0) closesByDate.set(brtDateFromTimestamp(timestamps[index]), close);
  }
  return { closesByDate };
}

/** Busca fechamentos diários por ticker interno para recomposição histórica de rentabilidade. */
export async function fetchHistoricalCloses(
  tickers: { ticker: string; assetClass: string }[],
  range = "1mo"
): Promise<Map<string, HistoricalCloseSeries>> {
  const results = new Map<string, HistoricalCloseSeries>();
  const yahooMap = new Map<string, string[]>();
  for (const { ticker, assetClass } of tickers) {
    const yahooTicker = toYahooTicker(ticker, assetClass);
    if (!yahooTicker) continue;
    yahooMap.set(yahooTicker, [...(yahooMap.get(yahooTicker) ?? []), ticker]);
  }
  const entries = Array.from(yahooMap.entries());
  for (let index = 0; index < entries.length; index += 10) {
    await Promise.all(entries.slice(index, index + 10).map(async ([yahooTicker, originals]) => {
      try {
        const series = await fetchYahooHistoricalCloses(yahooTicker, range);
        for (const ticker of originals) results.set(ticker, series);
      } catch (error) {
        console.warn(`[Quotes] Failed to fetch historical ${yahooTicker}:`, (error as Error).message);
      }
    }));
  }
  return results;
}

/** Busca fechamentos históricos do USD/BRL para converter retornos externos em BRL. */
export async function fetchHistoricalUsdBrlCloses(range = "1mo"): Promise<HistoricalCloseSeries> {
  try {
    return await fetchYahooHistoricalCloses("USDBRL=X", range);
  } catch {
    return { closesByDate: new Map() };
  }
}

/**
 * Busca cotações de múltiplos tickers via Yahoo Finance API
 */
export async function fetchQuotes(
  tickers: { ticker: string; assetClass: string }[]
): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();

  // Agrupa tickers por yahoo ticker (evita duplicatas como BTC e BTC_BIN)
  const yahooMap = new Map<string, string[]>(); // yahooTicker -> [originalTickers]
  for (const { ticker, assetClass } of tickers) {
    const yahooTicker = toYahooTicker(ticker, assetClass);
    if (!yahooTicker) continue;
    if (!yahooMap.has(yahooTicker)) {
      yahooMap.set(yahooTicker, []);
    }
    yahooMap.get(yahooTicker)!.push(ticker);
  }

  const yahooTickers = Array.from(yahooMap.keys());

  // Busca em lotes de 10
  const batchSize = 10;
  for (let i = 0; i < yahooTickers.length; i += batchSize) {
    const batch = yahooTickers.slice(i, i + batchSize);

    const promises = batch.map(async (yahooTicker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=1d`;
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        const chart = response.data?.chart?.result?.[0];
        if (!chart) return;

        const meta = chart.meta;
        const price = meta.regularMarketPrice ?? 0;

        // Preferir regularMarketChange (variação oficial do dia) quando disponível.
        // Fallback: calcular a partir do fechamento anterior.
        let change: number;
        let changePercent: number;

        if (meta.regularMarketChange !== undefined && meta.regularMarketChange !== null) {
          change = meta.regularMarketChange;
          changePercent = meta.regularMarketChangePercent ?? (price > 0 ? (change / (price - change)) * 100 : 0);
        } else {
          // Fallback: usar previousClose (mais confiável que chartPreviousClose para intraday)
          const previousClose =
            meta.previousClose ??
            meta.chartPreviousClose ??
            price;
          change = price - previousClose;
          changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        }

        const originalTickers = yahooMap.get(yahooTicker) || [];
        for (const origTicker of originalTickers) {
          results.set(origTicker, {
            ticker: origTicker,
            price,
            change,
            changePercent,
            currency: meta.currency || "USD",
            marketState: meta.marketState || "CLOSED",
          });
        }
      } catch (error) {
        console.warn(`[Quotes] Failed to fetch ${yahooTicker}:`, (error as Error).message);
      }
    });

    await Promise.all(promises);
  }

  return results;
}

/** Busca USD/BRL com preço atual e fechamento anterior para retorno em BRL. */
export async function fetchUsdBrlQuote(): Promise<FxQuote> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d";
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const meta = response.data?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice ?? DEFAULT_USD_BRL_RATE);
    const change = Number(
      meta?.regularMarketChange ??
      (meta?.previousClose !== undefined ? price - Number(meta.previousClose) : 0)
    );
    const previousClose = Number(meta?.previousClose ?? (price - change));
    return { price, change, previousClose };
  } catch {
    console.warn("[Quotes] Failed to fetch USD/BRL, using fallback");
    return { price: DEFAULT_USD_BRL_RATE, change: 0, previousClose: DEFAULT_USD_BRL_RATE };
  }
}

/** Busca apenas a cotação atual do dólar (USD/BRL). */
export async function fetchUsdBrl(): Promise<number> {
  return (await fetchUsdBrlQuote()).price;
}
