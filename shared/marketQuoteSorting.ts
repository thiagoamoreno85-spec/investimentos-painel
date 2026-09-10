export type MarketQuoteSort = "portfolio" | "yield_desc" | "yield_asc";

export type YieldSortableMarketQuote = {
  ticker: string;
  profitPct: number;
};

/**
 * Ordena pelo rendimento acumulado da posição (L/P percentual), sem modificar
 * o vetor originalmente entregue pela carteira.
 */
export function sortMarketQuotesByYield<T extends YieldSortableMarketQuote>(quotes: T[], sort: MarketQuoteSort): T[] {
  if (sort === "portfolio") return quotes;

  const factor = sort === "yield_desc" ? -1 : 1;
  return [...quotes].sort((left, right) => {
    const difference = (left.profitPct - right.profitPct) * factor;
    return difference !== 0 ? difference : left.ticker.localeCompare(right.ticker, "pt-BR");
  });
}
