export const CASH_PROVENT_TYPES = [
  "dividendo",
  "jcp",
  "rendimento",
  "amortizacao",
  "outro",
] as const;

export type CashProventType = (typeof CASH_PROVENT_TYPES)[number];

export type AnnualCashProceeds = {
  year: number;
  total: number;
};

export type CashProventRecord = {
  type: string;
  totalValue: string | number;
  paymentDate?: Date | string | null;
  exDate: Date | string;
};

export function isCashProvent(type: string): type is CashProventType {
  return CASH_PROVENT_TYPES.includes(type as CashProventType);
}

export function calculateYieldOnCost(totalCashProceeds: number, totalCost: number): number {
  if (!Number.isFinite(totalCashProceeds) || !Number.isFinite(totalCost) || totalCost <= 0) return 0;
  return (totalCashProceeds / totalCost) * 100;
}

/**
 * Agrupa créditos de caixa pelo ano de pagamento. Quando a data de pagamento
 * não foi cadastrada, usa a data-ex como melhor referência disponível.
 */
export function groupCashProceedsByYear(records: CashProventRecord[]): AnnualCashProceeds[] {
  const totals = new Map<number, number>();

  for (const record of records) {
    if (!isCashProvent(record.type)) continue;
    const date = new Date(record.paymentDate ?? record.exDate);
    const total = Number(record.totalValue);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(total)) continue;

    const year = date.getUTCFullYear();
    totals.set(year, (totals.get(year) ?? 0) + total);
  }

  return Array.from(totals, ([year, total]) => ({ year, total })).sort((a, b) => a.year - b.year);
}
