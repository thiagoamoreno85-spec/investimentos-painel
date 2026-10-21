import { describe, expect, it } from "vitest";
import {
  calculateAssetDayReturn,
  calculateMonthlyReturn,
  dailyPerformanceInternals,
} from "./services/dailyPerformanceService";

describe("calculateAssetDayReturn", () => {
  it("não trata uma compra no próprio dia como lucro", () => {
    const result = calculateAssetDayReturn({
      currentQty: 11,
      buyQty: 1,
      sellQty: 0,
      currentPrice: 100,
      previousPrice: 100,
      buyCost: 102,
      sellProceeds: 0,
      income: 0,
      currency: "BRL",
      currentFx: 1,
      previousFx: 1,
    });

    expect(result.startValueBRL).toBe(1000);
    expect(result.valueBRL).toBe(1100);
    expect(result.marketPnlBRL).toBe(-2);
    expect(result.changeBRL).toBe(-2);
  });

  it("considera a variação cambial mesmo com preço em dólar estável", () => {
    const result = calculateAssetDayReturn({
      currentQty: 10,
      buyQty: 0,
      sellQty: 0,
      currentPrice: 50,
      previousPrice: 50,
      buyCost: 0,
      sellProceeds: 0,
      income: 0,
      currency: "USD",
      currentFx: 5.1,
      previousFx: 5.2,
    });

    expect(result.startValueBRL).toBeCloseTo(2600, 8);
    expect(result.valueBRL).toBeCloseTo(2550, 8);
    expect(result.marketPnlBRL).toBeCloseTo(-50, 8);
  });

  it("soma proventos recebidos ao retorno sem confundi-los com aporte", () => {
    const result = calculateAssetDayReturn({
      currentQty: 100,
      buyQty: 0,
      sellQty: 0,
      currentPrice: 20,
      previousPrice: 20,
      buyCost: 0,
      sellProceeds: 0,
      income: 15,
      currency: "BRL",
      currentFx: 1,
      previousFx: 1,
    });

    expect(result.marketPnlBRL).toBe(0);
    expect(result.incomePnlBRL).toBe(15);
    expect(result.changeBRL).toBe(15);
  });

  it("reconhece o resultado econômico da venda contra o preço de abertura", () => {
    const result = calculateAssetDayReturn({
      currentQty: 8,
      buyQty: 0,
      sellQty: 2,
      currentPrice: 101,
      previousPrice: 100,
      buyCost: 0,
      sellProceeds: 210,
      income: 0,
      currency: "BRL",
      currentFx: 1,
      previousFx: 1,
    });

    expect(result.startValueBRL).toBe(1000);
    expect(result.valueBRL).toBe(808);
    expect(result.marketPnlBRL).toBe(18);
  });
});

describe("calculateMonthlyReturn", () => {
  it("encadeia retornos diários sem somar percentuais de forma incorreta", () => {
    const result = calculateMonthlyReturn([
      {
        date: "2026-09-01",
        returnPct: 1,
        returnValue: 100,
        externalContributionsBRL: 5000,
        externalWithdrawalsBRL: 0,
        byClass: [{ classKey: "rv_nacional", className: "RV Nacional", startValueBRL: 10000, valueBRL: 10100, marketPnlBRL: 100, incomePnlBRL: 0, changeBRL: 100, changePct: 1 }],
      },
      {
        date: "2026-09-02",
        returnPct: 2,
        returnValue: 202,
        externalContributionsBRL: 0,
        externalWithdrawalsBRL: 750,
        byClass: [{ classKey: "rv_nacional", className: "RV Nacional", startValueBRL: 10100, valueBRL: 10302, marketPnlBRL: 202, incomePnlBRL: 0, changeBRL: 202, changePct: 2 }],
      },
    ], "2026-09-01", false);

    expect(result?.total.percentDiff).toBeCloseTo(3.02, 8);
    expect(result?.total.valueDiff).toBe(302);
    expect(result?.byClass.rv_nacional.percentDiff).toBeCloseTo(3.02, 8);
    expect(result?.externalContributionsBRL).toBe(5000);
    expect(result?.externalWithdrawalsBRL).toBe(750);
    expect(result?.netExternalFlowBRL).toBe(4250);
    expect(result?.isPartial).toBe(false);
    expect(result?.lastClosedDate).toBe("2026-09-02");
  });

  it("sinaliza cobertura parcial quando o mês não possui seu primeiro dia registrado", () => {
    const result = calculateMonthlyReturn([
      {
        date: "2026-09-02",
        returnPct: 0.5,
        returnValue: 50,
        byClass: [],
      },
    ], "2026-09-01", true);

    expect(result?.isPartial).toBe(true);
    expect(result?.baseDate).toBe("2026-09-02");
    expect(result?.includesLiveDay).toBe(true);
    expect(result?.missingClosedDates).toEqual(["2026-09-01"]);
  });

  it("identifica dias úteis sem fechamento e ignora o fim de semana", () => {
    const result = calculateMonthlyReturn([
      { date: "2026-09-04", returnPct: 0.2, returnValue: 20, byClass: [], source: "ledger" },
      { date: "2026-09-08", returnPct: -0.1, returnValue: -10, byClass: [], source: "ledger" },
    ], "2026-09-04", false);

    expect(result?.closedSnapshotCount).toBe(2);
    expect(result?.missingClosedDates).toEqual(["2026-09-07"]);
    expect(result?.hasClosedGaps).toBe(true);
  });

  it("inclui todos os dias úteis anteriores do mês ao identificar lacunas no ledger", () => {
    expect(dailyPerformanceInternals.calendarDates("2026-09-01", "2026-09-04"))
      .toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  });
});
