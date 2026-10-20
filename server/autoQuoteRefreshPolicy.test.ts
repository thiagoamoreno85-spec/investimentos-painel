import { describe, expect, it } from "vitest";
import {
  AUTO_QUOTE_REFRESH_INTERVAL_MS,
  shouldAutoRefreshQuotes,
} from "../shared/autoQuoteRefreshPolicy";

const nowMs = Date.UTC(2026, 9, 20, 17, 0, 0);

function evaluate(overrides: Partial<Parameters<typeof shouldAutoRefreshQuotes>[0]> = {}) {
  return shouldAutoRefreshQuotes({
    hasAssets: true,
    isRefreshPending: false,
    isPageVisible: true,
    lastAttemptAtMs: null,
    nowMs,
    ...overrides,
  });
}

describe("política de atualização automática de cotações", () => {
  it("atualiza imediatamente na primeira abertura da Visão Geral", () => {
    expect(evaluate()).toBe(true);
  });

  it("respeita o intervalo de quinze minutos entre tentativas", () => {
    expect(evaluate({ lastAttemptAtMs: nowMs - AUTO_QUOTE_REFRESH_INTERVAL_MS + 1 })).toBe(false);
    expect(evaluate({ lastAttemptAtMs: nowMs - AUTO_QUOTE_REFRESH_INTERVAL_MS })).toBe(true);
  });

  it("não atualiza em aba oculta, sem ativos ou durante requisição pendente", () => {
    expect(evaluate({ isPageVisible: false })).toBe(false);
    expect(evaluate({ hasAssets: false })).toBe(false);
    expect(evaluate({ isRefreshPending: true })).toBe(false);
  });
});
