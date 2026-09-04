export type PortfolioSummaryAsset = {
  ticker: string;
  name: string | null;
  assetClass: string;
  currency: string | null;
  totalQuantity: string | number;
  averageCost: string | number;
  lastPrice: string | number;
};

export type HomePortfolioSummary = {
  totalPatrimony: number;
  investmentValue: number;
  investmentCost: number;
  investmentProfit: number;
  investmentProfitPct: number;
  cashBalance: number;
  classValues: Array<{ assetClass: string; value: number }>;
  assets: Array<{
    ticker: string;
    name: string;
    assetClass: string;
    valueBRL: number;
    profitBRL: number;
    profitPct: number;
  }>;
};

function asNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Consolida valores de mercado para a Visão Geral. O caixa integra o patrimônio,
 * mas nunca o lucro/prejuízo ou a rentabilidade dos investimentos.
 */
export function buildHomePortfolioSummary(
  assets: PortfolioSummaryAsset[],
  cashBalance: number,
  usdBrl: number
): HomePortfolioSummary {
  const classValues = new Map<string, number>();
  const summarizedAssets: HomePortfolioSummary["assets"] = [];
  let investmentValue = 0;
  let investmentCost = 0;

  for (const asset of assets) {
    if (asset.assetClass === "caixa") continue;

    const quantity = asNumber(asset.totalQuantity);
    const averageCost = asNumber(asset.averageCost);
    const lastPrice = asNumber(asset.lastPrice);
    const conversionRate = asset.currency === "USD" ? usdBrl : 1;
    const valueBRL = quantity * lastPrice * conversionRate;
    const costBRL = quantity * averageCost * conversionRate;
    const profit = valueBRL - costBRL;

    investmentValue += valueBRL;
    investmentCost += costBRL;
    classValues.set(asset.assetClass, (classValues.get(asset.assetClass) ?? 0) + valueBRL);
    summarizedAssets.push({
      ticker: asset.ticker,
      name: asset.name || asset.ticker,
      assetClass: asset.assetClass,
      valueBRL,
      profitBRL: profit,
      profitPct: costBRL > 0 ? (profit / costBRL) * 100 : 0,
    });
  }

  const validCashBalance = Number.isFinite(cashBalance) ? cashBalance : 0;
  if (validCashBalance > 0) {
    classValues.set("caixa", (classValues.get("caixa") ?? 0) + validCashBalance);
  }

  const investmentProfit = investmentValue - investmentCost;

  return {
    totalPatrimony: investmentValue + validCashBalance,
    investmentValue,
    investmentCost,
    investmentProfit,
    investmentProfitPct: investmentCost > 0 ? (investmentProfit / investmentCost) * 100 : 0,
    cashBalance: validCashBalance,
    classValues: Array.from(classValues.entries())
      .map(([assetClass, value]) => ({ assetClass, value }))
      .sort((a, b) => b.value - a.value),
    assets: summarizedAssets.sort((a, b) => b.valueBRL - a.valueBRL),
  };
}
