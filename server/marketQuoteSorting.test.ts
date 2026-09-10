import { describe, expect, it } from "vitest";
import { sortMarketQuotesByYield } from "../shared/marketQuoteSorting";

describe("sortMarketQuotesByYield", () => {
  const quotes = [
    { ticker: "AAA", profitPct: 12.5 },
    { ticker: "BBB", profitPct: -8.2 },
    { ticker: "CCC", profitPct: 1.7 },
  ];

  it("mantém a ordem original quando a ordem da carteira está selecionada", () => {
    expect(sortMarketQuotesByYield(quotes, "portfolio")).toBe(quotes);
  });

  it("ordena do maior para o menor rendimento acumulado", () => {
    expect(sortMarketQuotesByYield(quotes, "yield_desc").map((quote) => quote.ticker)).toEqual(["AAA", "CCC", "BBB"]);
  });

  it("ordena do menor para o maior rendimento acumulado", () => {
    expect(sortMarketQuotesByYield(quotes, "yield_asc").map((quote) => quote.ticker)).toEqual(["BBB", "CCC", "AAA"]);
  });
});
