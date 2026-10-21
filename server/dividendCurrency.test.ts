import { describe, expect, it } from "vitest";
import {
  buildDividendCurrencyMismatchMessage,
  isDividendCurrencyCompatible,
} from "../shared/dividendCurrency";

describe("política de moeda dos proventos", () => {
  it("aceita provento na mesma moeda nativa do ativo", () => {
    expect(isDividendCurrencyCompatible("BRL", "BRL")).toBe(true);
    expect(isDividendCurrencyCompatible("USD", "USD")).toBe(true);
  });

  it("recusa mistura de BRL e USD sem conversão identificada", () => {
    expect(isDividendCurrencyCompatible("BRL", "USD")).toBe(false);
    expect(isDividendCurrencyCompatible("USD", "BRL")).toBe(false);
  });

  it("explica a divergência com ticker e ambas as moedas", () => {
    expect(buildDividendCurrencyMismatchMessage("MSFT", "USD", "BRL"))
      .toContain("MSFT");
    expect(buildDividendCurrencyMismatchMessage("MSFT", "USD", "BRL"))
      .toContain("USD");
  });
});
