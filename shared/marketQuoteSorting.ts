export type MarketQuoteSort = "portfolio" | "yield_desc" | "yield_asc" | "monthly_desc" | "monthly_asc";

export type YieldSortableMarketQuote = {
  ticker: string;
  profitPct: number;
};

export type MonthlyChangeLookup<T extends YieldSortableMarketQuote> = (quote: T) => number | null | undefined;

function compareNullableMetric(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: "asc" | "desc",
): number {
  const leftIsValid = left !== null && left !== undefined && Number.isFinite(left);
  const rightIsValid = right !== null && right !== undefined && Number.isFinite(right);

  if (!leftIsValid && !rightIsValid) return 0;
  if (!leftIsValid) return 1;
  if (!rightIsValid) return -1;

  return direction === "desc" ? right - left : left - right;
}

/**
 * Ordena pelo rendimento acumulado da posição (L/P percentual), sem modificar
 * o vetor originalmente entregue pela carteira.
 */
export function sortMarketQuotesByYield<T extends YieldSortableMarketQuote>(
  quotes: T[],
  sort: MarketQuoteSort,
  getMonthlyChange?: MonthlyChangeLookup<T>,
): T[] {
  if (sort === "portfolio") return quotes;

  return [...quotes].sort((left, right) => {
    const isMonthlySort = sort === "monthly_desc" || sort === "monthly_asc";
    const difference = isMonthlySort
      ? compareNullableMetric(getMonthlyChange?.(left), getMonthlyChange?.(right), sort === "monthly_desc" ? "desc" : "asc")
      : compareNullableMetric(left.profitPct, right.profitPct, sort === "yield_desc" ? "desc" : "asc");
    return difference !== 0 ? difference : left.ticker.localeCompare(right.ticker, "pt-BR");
  });
}
