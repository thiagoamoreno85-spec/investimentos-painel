export type DividendCurrency = "BRL" | "USD";

/**
 * Um provento é informado e somado na moeda nativa do ativo. Conversões devem
 * ocorrer em um lançamento de câmbio explicitamente datado, nunca neste fluxo.
 */
export function isDividendCurrencyCompatible(
  assetCurrency: DividendCurrency,
  dividendCurrency: DividendCurrency,
): boolean {
  return assetCurrency === dividendCurrency;
}

export function buildDividendCurrencyMismatchMessage(
  ticker: string,
  assetCurrency: DividendCurrency,
  dividendCurrency: DividendCurrency,
): string {
  return `A moeda do provento (${dividendCurrency}) deve coincidir com a moeda do ativo ${ticker} (${assetCurrency}).`;
}
