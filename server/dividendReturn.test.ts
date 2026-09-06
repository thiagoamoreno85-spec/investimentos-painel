import { describe, expect, it } from "vitest";
import { calculateYieldOnCost, isCashProvent } from "@shared/dividendReturn";

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
});
