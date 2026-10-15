export type B3DailyInvestorFlow = {
  date: string;
  foreigners: number;
  institutional: number;
  individuals: number;
  financialInstitutions: number;
  other: number;
};

export type B3WeeklyFlowSummary = {
  reportedThrough: string;
  sessions: number;
  foreignFlowBRL: number;
  domesticFlowBRL: number;
};

/**
 * A página de referência expressa os valores em milhares de reais. Esta função
 * consolida os últimos pregões disponíveis e converte para BRL.
 */
export function summarizeLatestB3Sessions(
  rows: B3DailyInvestorFlow[],
  sessionCount = 5,
): B3WeeklyFlowSummary | null {
  const validRows = rows
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, sessionCount);

  if (validRows.length === 0) return null;

  const toBRL = (value: number) => value * 1_000;
  return {
    reportedThrough: validRows[0].date,
    sessions: validRows.length,
    foreignFlowBRL: validRows.reduce((total, row) => total + toBRL(row.foreigners), 0),
    domesticFlowBRL: validRows.reduce(
      (total, row) => total + toBRL(row.institutional + row.individuals + row.financialInstitutions + row.other),
      0,
    ),
  };
}

/**
 * Proxy de demanda offshore do EWZ. Criações/resgates efetivos não são
 * observáveis diretamente pela página pública da iShares; portanto, a métrica
 * usa a variação de cotas em circulação multiplicada pelo NAV de fechamento.
 */
export function calculateEwzShareFlowProxy(
  previousShares: number | null | undefined,
  currentShares: number | null | undefined,
  currentNavUsd: number | null | undefined,
): { sharesChange: number; flowProxyUsd: number } | null {
  if (
    !Number.isFinite(previousShares) ||
    !Number.isFinite(currentShares) ||
    !Number.isFinite(currentNavUsd) ||
    (previousShares ?? 0) <= 0 ||
    (currentShares ?? 0) <= 0 ||
    (currentNavUsd ?? 0) <= 0
  ) {
    return null;
  }

  const sharesChange = currentShares! - previousShares!;
  return { sharesChange, flowProxyUsd: sharesChange * currentNavUsd! };
}

export function formatBrtDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
