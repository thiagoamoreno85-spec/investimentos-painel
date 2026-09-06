import { describe, expect, it } from "vitest";
import { calculateYieldOnCost, groupCashProceedsByYear, isCashProvent } from "@shared/dividendReturn";

describe("retorno de proventos sobre custo", () => {
  it("inclui dividendos, JCP, rendimentos, amortizações e outros créditos de caixa", () => {
    expect(["dividendo", "jcp", "rendimento", "amortizacao", "outro"].every(isCashProvent)).toBe(true);
  });

  it("exclui bonificação do Yield sobre Custo por não representar caixa recebido", () => {
    expect(isCashProvent("bonificacao")).toBe(false);
  });

  it("calcula o yield acumulado contra o custo atual da posição", () => {
    expect(calculateYieldOnCost(825, 15000)).toBeCloseTo(5.5);
  });

  it("não calcula retorno quando não há custo positivo", () => {
    expect(calculateYieldOnCost(825, 0)).toBe(0);
  });

  it("agrupa proventos por ano de pagamento e usa a data-ex como fallback", () => {
    expect(groupCashProceedsByYear([
      { type: "dividendo", totalValue: "125.50", paymentDate: new Date("2025-02-15T12:00:00Z"), exDate: new Date("2025-02-01T12:00:00Z") },
      { type: "jcp", totalValue: 74.5, paymentDate: null, exDate: new Date("2025-08-12T12:00:00Z") },
      { type: "rendimento", totalValue: 200, paymentDate: new Date("2026-01-10T12:00:00Z"), exDate: new Date("2025-12-30T12:00:00Z") },
    ])).toEqual([
      { year: 2025, total: 200 },
      { year: 2026, total: 200 },
    ]);
  });

  it("não soma bonificações à evolução anual de recebimentos", () => {
    expect(groupCashProceedsByYear([
      { type: "bonificacao", totalValue: 150, exDate: new Date("2026-01-01T12:00:00Z") },
      { type: "dividendo", totalValue: 40, exDate: new Date("2026-02-01T12:00:00Z") },
    ])).toEqual([{ year: 2026, total: 40 }]);
  });
});
