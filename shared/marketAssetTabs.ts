export const MARKET_ASSET_TABS = [
  { id: "rv_nacional", label: "RV Nacional", dotClass: "bg-blue-500" },
  { id: "fundos", label: "Fundos", dotClass: "bg-cyan-500" },
  { id: "rv_eua", label: "RV EUA", dotClass: "bg-violet-500" },
  { id: "cripto", label: "Criptomoedas", dotClass: "bg-amber-500" },
  { id: "renda_fixa", label: "Renda Fixa", dotClass: "bg-teal-500" },
  { id: "uranio", label: "Urânio", dotClass: "bg-pink-500" },
  { id: "india", label: "Índia", dotClass: "bg-orange-500" },
  { id: "caixa", label: "Caixa", dotClass: "bg-emerald-500" },
] as const;

export type MarketAssetTabId = (typeof MARKET_ASSET_TABS)[number]["id"];

export type MarketClassifiableAsset = {
  assetClass: string;
};

export function isMarketAssetTab(value: string): value is MarketAssetTabId {
  return MARKET_ASSET_TABS.some((tab) => tab.id === value);
}

export function filterMarketAssetsByClass<T extends MarketClassifiableAsset>(assets: T[], assetClass: MarketAssetTabId): T[] {
  return assets.filter((asset) => asset.assetClass === assetClass);
}
