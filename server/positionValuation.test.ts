import { describe, expect, it } from "vitest";
import { calculatePositionValuation } from "@shared/positionValuation";

describe("calculatePositionValuation", () => {
  it("separa custo, valor atual e lucro de uma posição de renda fixa", () => {
    const result = calculatePositionValuation(3, 1_000, 1_063.01);
    expect(result.costValue).toBe(3_000);
    expect(result.currentValue).toBeCloseTo(3_189.03, 8);
    expect(result.profit).toBeCloseTo(189.03, 8);
    expect(result.profitPercentage).toBeCloseTo(6.301, 8);
  });

  it("não cria rentabilidade percentual quando não há custo registrado", () => {
    expect(calculatePositionValuation(1, 0, 1_000)).toEqual({
      costValue: 0,
      currentValue: 1_000,
      profit: 1_000,
      profitPercentage: 0,
    });
  });
});
