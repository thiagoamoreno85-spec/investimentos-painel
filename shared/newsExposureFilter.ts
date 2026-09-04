export type ExposureNews = {
  affectedPortfolioPct: number;
};

export type TickerTaggedNews = {
  affectedTickers: string[];
};

export type MajorExposureSelection<T extends ExposureNews> = {
  thresholdPct: number;
  items: T[];
};

/**
 * Seleciona o quartil superior das notícias com exposição direta à carteira.
 * Empates no ponto de corte são preservados para que posições de mesmo peso
 * recebam o mesmo tratamento.
 */
export function selectMajorExposureNews<T extends ExposureNews>(
  news: T[]
): MajorExposureSelection<T> {
  const directItems = news
    .filter((item) => Number.isFinite(item.affectedPortfolioPct) && item.affectedPortfolioPct > 0)
    .sort((a, b) => b.affectedPortfolioPct - a.affectedPortfolioPct);

  if (directItems.length === 0) return { thresholdPct: 0, items: [] };

  const cutoffIndex = Math.max(0, Math.ceil(directItems.length * 0.25) - 1);
  const thresholdPct = directItems[cutoffIndex]?.affectedPortfolioPct ?? 0;

  return {
    thresholdPct,
    items: directItems.filter((item) => item.affectedPortfolioPct >= thresholdPct),
  };
}

/** Filtra notícias cujo conjunto de tickers contém o ativo selecionado, normalizando o sufixo .SA. */
export function filterNewsByTicker<T extends TickerTaggedNews>(news: T[], ticker: string): T[] {
  if (ticker === "all") return news;
  const normalizedTicker = ticker.toUpperCase().replace(/\.SA$/, "");
  return news.filter((item) => item.affectedTickers.some(
    (affectedTicker) => affectedTicker.toUpperCase().replace(/\.SA$/, "") === normalizedTicker
  ));
}
