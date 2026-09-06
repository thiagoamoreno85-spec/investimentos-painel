export const CASH_PROVENT_TYPES = [
  "dividendo",
  "jcp",
  "rendimento",
  "amortizacao",
  "outro",
] as const;

export type CashProventType = (typeof CASH_PROVENT_TYPES)[number];

export function isCashProvent(type: string): type is CashProventType {
  return CASH_PROVENT_TYPES.includes(type as CashProventType);
}

export function calculateYieldOnCost(totalCashProceeds: number, totalCost: number): number {
  if (!Number.isFinite(totalCashProceeds) || !Number.isFinite(totalCost) || totalCost <= 0) return 0;
  return (totalCashProceeds / totalCost) * 100;
}
