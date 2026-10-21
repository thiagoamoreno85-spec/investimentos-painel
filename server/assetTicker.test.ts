import { describe, expect, it } from "vitest";
import { isSameNormalizedTicker, normalizeAssetTicker } from "../shared/assetTicker";

describe("normalização de ticker", () => {
  it("remove espaços externos e padroniza caixa", () => {
    expect(normalizeAssetTicker(" vale3 ")).toBe("VALE3");
    expect(isSameNormalizedTicker(" VALE3", "vale3 ")).toBe(true);
  });

  it("rejeita ticker vazio", () => {
    expect(() => normalizeAssetTicker("   ")).toThrow("Ticker inválido");
  });
});
