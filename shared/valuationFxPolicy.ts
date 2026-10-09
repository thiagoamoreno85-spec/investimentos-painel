export type ValuationFxSource = "conciliacao" | "mercado";

export type ValuationFxResolution = {
  rate: number;
  source: ValuationFxSource;
};

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Prioriza o câmbio-base aprovado em uma conciliação. Sem referência válida,
 * mantém a cotação de mercado em tempo real.
 */
export function resolveValuationFxRate(
  marketRate: number,
  approvedReferenceRate?: number | null,
): ValuationFxResolution {
  if (isPositiveFinite(approvedReferenceRate)) {
    return { rate: approvedReferenceRate, source: "conciliacao" };
  }
  return { rate: marketRate, source: "mercado" };
}
