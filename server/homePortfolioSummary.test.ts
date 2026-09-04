import { describe, expect, it } from "vitest";
import { buildHomePortfolioSummary } from "../shared/homePortfolioSummary";

describe("buildHomePortfolioSummary", () => {
  it("inclui caixa no patrimônio, mas o exclui do lucro e da rentabilidade dos investimentos", () => {
    const summary = buildHomePortfolioSummary([
      {
        ticker: "BRTEST3",
        name: "Ativo Brasil",
        assetClass: "rv_nacional",
        currency: "BRL",
        totalQuantity: "10",
        averageCost: "10",
        lastPrice: "12",
      },
      {
        ticker: "USTEST",
        name: "Ativo EUA",
        assetClass: "rv_eua",
        currency: "USD",
        totalQuantity: "2",
        averageCost: "100",
        lastPrice: "110",
      },
    ], 500, 5);

    expect(summary.investmentValue).toBe(1220);
    expect(summary.investmentCost).toBe(1100);
    expect(summary.investmentProfit).toBe(120);
    expect(summary.investmentProfitPct).toBeCloseTo(120 / 11, 8);
    expect(summary.cashBalance).toBe(500);
    expect(summary.totalPatrimony).toBe(1720);
  });

  it("ignora ativos legados de classe caixa para evitar dupla contagem", () => {
    const summary = buildHomePortfolioSummary([
      {
        ticker: "CAIXA_LEGADO",
        name: "Caixa legado",
        assetClass: "caixa",
        currency: "BRL",
        totalQuantity: "1",
        averageCost: "999",
        lastPrice: "999",
      },
      {
        ticker: "VALE3",
        name: "Vale",
        assetClass: "rv_nacional",
        currency: "BRL",
        totalQuantity: "1",
        averageCost: "60",
        lastPrice: "70",
      },
    ], 250, 5);

    expect(summary.totalPatrimony).toBe(320);
    expect(summary.investmentProfit).toBe(10);
    expect(summary.classValues).toEqual([
      { assetClass: "caixa", value: 250 },
      { assetClass: "rv_nacional", value: 70 },
    ]);
    expect(summary.assets).toHaveLength(1);
    expect(summary.assets[0]?.ticker).toBe("VALE3");
  });
});
