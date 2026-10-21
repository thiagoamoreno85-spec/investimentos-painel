export type BuyAdvisorCacheAsset = {
  id: number;
  ticker: string;
  quantity: string;
  averageCost: string;
  price: string;
  updatedAt: string | null;
};

export type BuyAdvisorCacheContext = {
  availableAmount: string;
  focus: "brasil" | "eua" | "todos";
  userContext: string;
  assets: BuyAdvisorCacheAsset[];
};

export const BUY_ADVISOR_DATA_VERSION = "buy-advisor-v2";

/**
 * Representação determinística do contexto financeiro da análise.
 * A hash é calculada no servidor; esta função permite testar quando o cache deve expirar.
 */
export function buildBuyAdvisorCachePayload(context: BuyAdvisorCacheContext): string {
  return JSON.stringify({
    version: BUY_ADVISOR_DATA_VERSION,
    availableAmount: context.availableAmount,
    focus: context.focus,
    userContext: context.userContext.trim(),
    assets: [...context.assets]
      .sort((left, right) => left.id - right.id)
      .map((asset) => ({
        id: asset.id,
        ticker: asset.ticker,
        quantity: asset.quantity,
        averageCost: asset.averageCost,
        price: asset.price,
        updatedAt: asset.updatedAt,
      })),
  });
}
