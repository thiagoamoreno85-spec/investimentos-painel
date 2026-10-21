export function normalizeAssetTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  if (!ticker || ticker.length > 32) {
    throw new Error("Ticker inválido");
  }
  return ticker;
}

export function isSameNormalizedTicker(left: string, right: string): boolean {
  return normalizeAssetTicker(left) === normalizeAssetTicker(right);
}
