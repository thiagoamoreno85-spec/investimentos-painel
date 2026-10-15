import { describe, expect, it } from "vitest";
import { calculateEwzShareFlowProxy, summarizeLatestB3Sessions } from "./marketFlow";

describe("summarizeLatestB3Sessions", () => {
  it("consolida os últimos pregões divulgados e converte milhares em BRL", () => {
    const summary = summarizeLatestB3Sessions([
      { date: "2026-10-09", foreigners: 1_030_716, institutional: -709_921, individuals: -320_214, financialInstitutions: 195_557, other: -196_139 },
      { date: "2026-10-08", foreigners: 1_645_451, institutional: -52_732, individuals: 28_540, financialInstitutions: -1_407_056, other: -214_204 },
      { date: "2026-10-07", foreigners: -627_864, institutional: 676_155, individuals: 155_137, financialInstitutions: 177_013, other: -380_441 },
    ], 2);

    expect(summary).toEqual({
      reportedThrough: "2026-10-09",
      sessions: 2,
      foreignFlowBRL: 2_676_167_000,
      domesticFlowBRL: -2_676_169_000,
    });
  });

  it("retorna nulo sem pregões válidos", () => {
    expect(summarizeLatestB3Sessions([])).toBeNull();
  });
});

describe("calculateEwzShareFlowProxy", () => {
  it("calcula o proxy de criação/resgate pela variação das cotas", () => {
    expect(calculateEwzShareFlowProxy(300_000_000, 312_350_000, 42.5)).toEqual({
      sharesChange: 12_350_000,
      flowProxyUsd: 524_875_000,
    });
  });

  it("não estima fluxo sem base comparável", () => {
    expect(calculateEwzShareFlowProxy(null, 312_350_000, 42.5)).toBeNull();
  });
});
