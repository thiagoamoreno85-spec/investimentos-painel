import { writeFile } from "node:fs/promises";
import { callDataApi } from "../server/_core/dataApi";

type ChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        currency?: string;
        exchangeName?: string;
        regularMarketTime?: number;
      };
    }>;
  };
};

const symbols = ["INDA", "HDB", "IBN", "INFY", "BOVA11.SA", "BRL=X"] as const;

const results = await Promise.all(
  symbols.map(async (symbol) => {
    const result = (await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol,
        region: symbol.endsWith(".SA") ? "BR" : "US",
        interval: "1d",
        range: "5d",
        includeAdjustedClose: "true",
      },
    })) as ChartPayload;

    return { requestedSymbol: symbol, data: result.chart?.result?.[0]?.meta ?? null };
  })
);

await writeFile(
  "/home/ubuntu/india_hedge_market_data_20260901.json",
  JSON.stringify({ collectedAt: new Date().toISOString(), quotes: results }, null, 2)
);
