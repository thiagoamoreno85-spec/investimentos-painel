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

  it("ordena da maior para a menor alta mensal e deixa históricos indisponíveis ao final", () => {
    const monthlyChanges = new Map([
      ["AAA", 2.3],
      ["BBB", -4.8],
    ]);

    expect(
      sortMarketQuotesByYield(quotes, "monthly_desc", (quote) => monthlyChanges.get(quote.ticker)).map((quote) => quote.ticker),
    ).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("ordena da menor para a maior variação mensal e deixa históricos indisponíveis ao final", () => {
    const monthlyChanges = new Map([
      ["AAA", 2.3],
      ["BBB", -4.8],
    ]);

    expect(
      sortMarketQuotesByYield(quotes, "monthly_asc", (quote) => monthlyChanges.get(quote.ticker)).map((quote) => quote.ticker),
    ).toEqual(["BBB", "AAA", "CCC"]);
  });

  it("ordena da maior para a menor alta diária e mantém cotações indisponíveis ao final", () => {
    const dailyQuotes = [
      { ticker: "AAA", profitPct: 12.5, changePercent: 1.2 },
      { ticker: "BBB", profitPct: -8.2, changePercent: -3.8 },
      { ticker: "CCC", profitPct: 1.7, changePercent: null },
    ];

    expect(sortMarketQuotesByYield(dailyQuotes, "daily_desc").map((quote) => quote.ticker)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("ordena da menor para a maior variação diária", () => {
    const dailyQuotes = [
      { ticker: "AAA", profitPct: 12.5, changePercent: 1.2 },
      { ticker: "BBB", profitPct: -8.2, changePercent: -3.8 },
      { ticker: "CCC", profitPct: 1.7, changePercent: 0.4 },
    ];

    expect(sortMarketQuotesByYield(dailyQuotes, "daily_asc").map((quote) => quote.ticker)).toEqual(["BBB", "CCC", "AAA"]);
  });
});
