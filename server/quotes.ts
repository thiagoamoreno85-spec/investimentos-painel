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

/**
 * Converte ticker do formato interno para o formato Yahoo Finance
 */
function toYahooTicker(ticker: string, assetClass: string): string | null {
  // Caixa e fundos não têm cotação
  if (["caixa", "fundos", "renda_fixa"].includes(assetClass)) return null;

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

  // Ações brasileiras (terminam em 3, 4, 5, 6, 7, 11, 32)
  if (assetClass === "rv_nacional") {
    if (ticker === "XPML11") return "XPML11.SA";
    if (ticker === "KLBN11") return "KLBN11.SA";
    if (ticker === "BPAC11") return "BPAC11.SA";
    if (ticker === "INBR32") return "INBR32.SA";
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
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

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

/**
 * Busca cotação do dólar (USD/BRL)
 */
export async function fetchUsdBrl(): Promise<number> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d";
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const meta = response.data?.chart?.result?.[0]?.meta;
    return meta?.regularMarketPrice ?? DEFAULT_USD_BRL_RATE;
  } catch {
    console.warn("[Quotes] Failed to fetch USD/BRL, using fallback");
    return DEFAULT_USD_BRL_RATE;
  }
}
