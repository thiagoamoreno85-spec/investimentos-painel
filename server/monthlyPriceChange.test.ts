import { describe, expect, it } from "vitest";
import { calculateMonthlyPriceChange, getMonthlyPriceReference } from "../shared/monthlyPriceChange";

const NOW = new Date("2026-09-09T15:00:00.000Z");

describe("monthlyPriceChange", () => {
  it("usa o último fechamento anterior ao início do mês como referência", () => {
    const closes = new Map([
      ["2026-08-28", 96],
      ["2026-08-31", 100],
      ["2026-09-01", 101],
      ["2026-09-08", 104],
    ]);

    expect(getMonthlyPriceReference(closes, NOW)).toEqual({ date: "2026-08-31", price: 100 });
  });

  it("calcula a variação de preço do mês sem confundir com preço médio", () => {
    const closes = new Map([["2026-08-31", 100], ["2026-09-08", 104]]);

    expect(calculateMonthlyPriceChange(105, closes, NOW)).toEqual({
      date: "2026-08-31",
      price: 100,
      change: 5,
      changePercent: 5,
    });
  });

  it("não inventa variação quando não há fechamento anterior ao mês", () => {
    const closes = new Map([["2026-09-01", 100]]);
    expect(calculateMonthlyPriceChange(105, closes, NOW)).toBeNull();
  });
});
