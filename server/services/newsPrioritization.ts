export type PrioritizableNews = {
  impactLevel: string | null;
  affectedTickers: string[];
  createdAt: Date;
  isRead: number;
};

export type ExposureAsset = {
  ticker: string;
  totalQuantity: string | number;
  lastPrice: string | number;
  currency: string | null;
};

export type PrioritizedNews<T extends PrioritizableNews> = Omit<
  T,
  "priorityScore" | "affectedValueBRL" | "affectedPortfolioPct" | "matchedTickers" | "portfolioRelevance"
> & {
  priorityScore: number;
  affectedValueBRL: number;
  affectedPortfolioPct: number;
  matchedTickers: string[];
  portfolioRelevance: "alta" | "direta" | "contexto";
};

function toNumber(value: string | number): number {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function tickerKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.SA$/, "");
}

function impactScore(impactLevel: string | null): number {
  if (impactLevel === "alto") return 600;
  if (impactLevel === "medio") return 320;
  return 100;
}

function recencyScore(createdAt: Date): number {
  const hours = Math.max(0, Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours <= 6) return 100;
  if (hours <= 24) return 70;
  if (hours <= 72) return 35;
  return 0;
}

/** Ordena notícias pelo impacto, vínculo direto e peso financeiro dos ativos atingidos. */
export function prioritizeNewsForPortfolio<T extends PrioritizableNews>(
  news: T[],
  assets: ExposureAsset[],
  usdBrl: number
): PrioritizedNews<T>[] {
  const assetByTicker = new Map<string, { ticker: string; valueBRL: number }>();
  let portfolioValueBRL = 0;

  for (const asset of assets) {
    const quantity = toNumber(asset.totalQuantity);
    const price = toNumber(asset.lastPrice);
    const conversion = asset.currency === "USD" ? usdBrl : 1;
    const valueBRL = Math.max(0, quantity * price * conversion);
    portfolioValueBRL += valueBRL;
    assetByTicker.set(tickerKey(asset.ticker), { ticker: asset.ticker, valueBRL });
  }

  return news
    .map((item) => {
      const matched = new Map<string, number>();
      for (const ticker of item.affectedTickers) {
        const asset = assetByTicker.get(tickerKey(ticker));
        if (asset) matched.set(asset.ticker, asset.valueBRL);
      }

      const matchedTickers = Array.from(matched.keys());
      const affectedValueBRL = Array.from(matched.values()).reduce((sum, value) => sum + value, 0);
      const affectedPortfolioPct = portfolioValueBRL > 0 ? (affectedValueBRL / portfolioValueBRL) * 100 : 0;
      const directExposureScore = Math.min(250, affectedPortfolioPct * 25);
      const tickerScore = Math.min(120, matchedTickers.length * 50);
      const priorityScore = Math.round(
        impactScore(item.impactLevel) +
        directExposureScore +
        tickerScore +
        recencyScore(item.createdAt) +
        (item.isRead === 0 ? 20 : 0)
      );
      const portfolioRelevance: "alta" | "direta" | "contexto" = item.impactLevel === "alto" && matchedTickers.length > 0
        ? "alta"
        : matchedTickers.length > 0
        ? "direta"
        : "contexto";

      return {
        ...item,
        priorityScore,
        affectedValueBRL,
        affectedPortfolioPct,
        matchedTickers,
        portfolioRelevance,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
