import { describe, expect, it } from "vitest";
import { getMonthlyVariationHighlight } from "../shared/monthlyVariationHighlight";

describe("getMonthlyVariationHighlight", () => {
  it("destaca apenas altas mensais estritamente superiores a cinco por cento", () => {
    expect(getMonthlyVariationHighlight(5)).toBe("neutral");
    expect(getMonthlyVariationHighlight(5.01)).toBe("high_gain");
  });

  it("destaca apenas baixas mensais estritamente inferiores a menos cinco por cento", () => {
    expect(getMonthlyVariationHighlight(-5)).toBe("neutral");
    expect(getMonthlyVariationHighlight(-5.01)).toBe("high_loss");
  });

  it("diferencia variação neutra de histórico indisponível", () => {
    expect(getMonthlyVariationHighlight(0)).toBe("neutral");
    expect(getMonthlyVariationHighlight(null)).toBe("unavailable");
  });
});
