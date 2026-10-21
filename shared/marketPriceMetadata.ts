export type MarketPriceMetadata = {
  currency: "BRL" | "USD" | string;
  source?: string | null;
  state?: string | null;
  asOf?: Date | string | null;
  referenceDate?: Date | string | null;
};

export function getPriceMetadataLabel(metadata: MarketPriceMetadata): string {
  const source = metadata.source ?? "Legado sem fonte";
  const state = metadata.state ?? "proveniência não informada";
  const asOf = metadata.asOf
    ? new Date(metadata.asOf).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : metadata.referenceDate
      ? `base ${new Date(metadata.referenceDate).toLocaleDateString("pt-BR")}`
      : "sem data-base";
  return `${source} · ${metadata.currency} · ${state} · ${asOf}`;
}
