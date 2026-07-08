/**
 * Identidade visual das classes de ativo — fonte única de verdade.
 *
 * Cores categóricas fixas por classe (a cor segue a entidade, nunca a posição),
 * validadas para contraste >= 3:1 sobre a superfície dark e separação CVD
 * (protan/deutan/tritan) com codificação secundária (labels + gaps).
 */

export const ASSET_CLASS_LABELS: Record<string, string> = {
  rv_nacional: "RV Nacional",
  rv_eua: "RV EUA",
  fundos: "Fundos",
  cripto: "Criptomoedas",
  renda_fixa: "Renda Fixa",
  uranio: "Urânio",
  india: "Índia",
  caixa: "Caixa",
};

export const ASSET_CLASS_SHORT_LABELS: Record<string, string> = {
  rv_nacional: "RV Nac.",
  rv_eua: "RV EUA",
  fundos: "Fundos",
  cripto: "Cripto",
  renda_fixa: "RF",
  uranio: "Urânio",
  india: "Índia",
  caixa: "Caixa",
};

export const CLASS_CURRENCY: Record<string, string> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
  caixa: "BRL",
};

/** Cor fixa por classe — atribuição estável, nunca ciclada. */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  rv_nacional: "#3b82f6", // azul
  rv_eua: "#8b5cf6",      // violeta
  fundos: "#0891b2",      // ciano
  cripto: "#d97706",      // âmbar
  renda_fixa: "#0d9488",  // teal
  uranio: "#db2777",      // rosa
  india: "#ea580c",       // laranja
  caixa: "#059669",       // esmeralda
};

/** Cor por rótulo legível (para dados agregados que só têm o label). */
export const ASSET_CLASS_COLORS_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ASSET_CLASS_LABELS).map(([key, label]) => [
    label,
    ASSET_CLASS_COLORS[key],
  ])
);

export function classColor(classKeyOrLabel: string): string {
  return (
    ASSET_CLASS_COLORS[classKeyOrLabel] ??
    ASSET_CLASS_COLORS_BY_LABEL[classKeyOrLabel] ??
    "#64748b"
  );
}
