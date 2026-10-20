export const AUTO_QUOTE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export type AutoQuoteRefreshInput = {
  hasAssets: boolean;
  isRefreshPending: boolean;
  isPageVisible: boolean;
  lastAttemptAtMs: number | null;
  nowMs: number;
};

/**
 * Define se a Visão Geral deve consultar cotações agora.
 * A proteção temporal reduz chamadas redundantes e a regra de visibilidade
 * evita atualizar o mercado quando a aba não está em primeiro plano.
 */
export function shouldAutoRefreshQuotes(input: AutoQuoteRefreshInput): boolean {
  if (!input.hasAssets || input.isRefreshPending || !input.isPageVisible) return false;
  if (input.lastAttemptAtMs === null) return true;
  return input.nowMs - input.lastAttemptAtMs >= AUTO_QUOTE_REFRESH_INTERVAL_MS;
}
