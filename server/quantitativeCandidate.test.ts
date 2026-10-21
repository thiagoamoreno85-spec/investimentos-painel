import { describe, expect, it } from "vitest";
import { buildQuantitativeCandidate } from "../shared/quantitativeCandidate";

describe("triagem quantitativa por moeda", () => {
  it("converte corretamente um orçamento em BRL para ação cotada em USD", () => {
    const candidate = buildQuantitativeCandidate({
      ticker: "AAPL", assetClass: "rv_eua", nativePrice: 180, quoteCurrency: "USD", availableAmountBRL: 1200, usdBrl: 5.7,
    });
    expect(candidate?.purchasableQuantity).toBe(1);
    expect(candidate?.priceBRL).toBeCloseTo(1026);
    expect(candidate?.estimatedSpendBRL).toBeCloseTo(1026);
  });

  it("preserva frações para criptoativos", () => {
    const candidate = buildQuantitativeCandidate({
      ticker: "BTC_BIN", assetClass: "cripto", nativePrice: 80000, quoteCurrency: "USD", availableAmountBRL: 1000, usdBrl: 5,
    });
    expect(candidate?.purchasableQuantity).toBeCloseTo(0.0025, 8);
    expect(candidate?.estimatedSpendBRL).toBeCloseTo(1000);
  });

  it("não habilita triagem com classes manuais", () => {
    expect(buildQuantitativeCandidate({
      ticker: "CDB", assetClass: "renda_fixa", nativePrice: 1000, quoteCurrency: "BRL", availableAmountBRL: 1000, usdBrl: 5,
    })).toBeNull();
  });
});
