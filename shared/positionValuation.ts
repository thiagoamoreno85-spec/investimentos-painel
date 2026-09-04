export type PositionValuation = {
  costValue: number;
  currentValue: number;
  profit: number;
  profitPercentage: number;
};

/** Calcula a marcação da posição sem incluir aportes, vendas ou proventos como lucro. */
export function calculatePositionValuation(
  quantity: number,
  unitCost: number,
  currentPrice: number
): PositionValuation {
  const costValue = quantity * unitCost;
  const currentValue = quantity * currentPrice;
  const profit = currentValue - costValue;
  const profitPercentage = costValue > 0 ? (profit / costValue) * 100 : 0;

  return { costValue, currentValue, profit, profitPercentage };
}
