export type MonthlyVariationHighlight = "high_gain" | "high_loss" | "neutral" | "unavailable";

export const MONTHLY_VARIATION_ALERT_THRESHOLD = 5;

/**
 * Classifica a variação mensal exclusivamente para fins visuais. O limiar é
 * estrito: +5,00% e -5,00% permanecem neutros; somente valores além dele são
 * tratados como movimentos fortes.
 */
export function getMonthlyVariationHighlight(value: number | null | undefined): MonthlyVariationHighlight {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unavailable";
  if (value > MONTHLY_VARIATION_ALERT_THRESHOLD) return "high_gain";
  if (value < -MONTHLY_VARIATION_ALERT_THRESHOLD) return "high_loss";
  return "neutral";
}
