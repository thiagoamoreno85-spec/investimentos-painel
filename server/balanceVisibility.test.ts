import { describe, expect, it } from "vitest";
import { parseBalanceVisibilityPreference } from "@shared/balanceVisibility";

describe("parseBalanceVisibilityPreference", () => {
  it("mantém valores visíveis quando não há preferência armazenada", () => {
    expect(parseBalanceVisibilityPreference(null)).toBe(true);
  });

  it("restaura explicitamente o modo de privacidade", () => {
    expect(parseBalanceVisibilityPreference("false")).toBe(false);
    expect(parseBalanceVisibilityPreference("true")).toBe(true);
  });

  it("ignora dados inválidos do armazenamento local sem bloquear o painel", () => {
    expect(parseBalanceVisibilityPreference("valor-inválido")).toBe(true);
    expect(parseBalanceVisibilityPreference('"false"')).toBe(true);
  });
});
