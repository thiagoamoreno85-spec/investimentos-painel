export type QuoteCurrency = "BRL" | "USD";
export type QuantitativeAssetClass = "rv_nacional" | "rv_eua" | "fundos" | "cripto" | "renda_fixa" | "uranio" | "india" | "caixa";

export type QuantitativeCandidateInput = {
  ticker: string;
  assetClass: QuantitativeAssetClass;
  nativePrice: number;
  quoteCurrency: QuoteCurrency;
  availableAmountBRL: number;
  usdBrl: number;
};

export type QuantitativeCandidate = {
  ticker: string;
  assetClass: QuantitativeAssetClass;
  nativePrice: number;
  quoteCurrency: QuoteCurrency;
  priceBRL: number;
  purchasableQuantity: number;
  estimatedSpendNative: number;
  estimatedSpendBRL: number;
};

const MANUAL_OR_NON_INVESTABLE_CLASSES: QuantitativeAssetClass[] = ["fundos", "renda_fixa", "caixa"];

export function isQuantitativeCandidateClass(assetClass: QuantitativeAssetClass): boolean {
  return !MANUAL_OR_NON_INVESTABLE_CLASSES.includes(assetClass);
}

export function buildQuantitativeCandidate(input: QuantitativeCandidateInput): QuantitativeCandidate | null {
  if (!isQuantitativeCandidateClass(input.assetClass)) return null;
  if (!Number.isFinite(input.nativePrice) || input.nativePrice <= 0) return null;
  if (!Number.isFinite(input.availableAmountBRL) || input.availableAmountBRL <= 0) return null;
  if (input.quoteCurrency === "USD" && (!Number.isFinite(input.usdBrl) || input.usdBrl <= 0)) return null;

  const priceBRL = input.quoteCurrency === "USD" ? input.nativePrice * input.usdBrl : input.nativePrice;
  const nativeBudget = input.quoteCurrency === "USD" ? input.availableAmountBRL / input.usdBrl : input.availableAmountBRL;
  const rawQuantity = nativeBudget / input.nativePrice;
  const precision = input.assetClass === "cripto" ? 8 : 0;
  const factor = 10 ** precision;
  const purchasableQuantity = Math.floor((rawQuantity + Number.EPSILON) * factor) / factor;
  const estimatedSpendNative = purchasableQuantity * input.nativePrice;
  const estimatedSpendBRL = purchasableQuantity * priceBRL;

  return {
    ticker: input.ticker,
    assetClass: input.assetClass,
    nativePrice: input.nativePrice,
    quoteCurrency: input.quoteCurrency,
    priceBRL,
    purchasableQuantity,
    estimatedSpendNative,
    estimatedSpendBRL,
  };
}
