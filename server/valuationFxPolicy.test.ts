import { describe, expect, it } from "vitest";
import { resolveValuationFxRate } from "../shared/valuationFxPolicy";

describe("resolveValuationFxRate", () => {
  it("prioriza o câmbio-base aprovado para preservar a conciliação", () => {
    expect(resolveValuationFxRate(4.989, 4.987)).toEqual({
      rate: 4.987,
      source: "conciliacao",
    });
  });

  it("mantém a cotação de mercado quando não há referência válida", () => {
    expect(resolveValuationFxRate(4.989, null)).toEqual({ rate: 4.989, source: "mercado" });
    expect(resolveValuationFxRate(4.989, 0)).toEqual({ rate: 4.989, source: "mercado" });
  });
});
