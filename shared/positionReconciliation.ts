export type PositionTrackingMode = "ledger" | "reconciled";

export type PositionLedgerTransaction = {
  id: number;
  type: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  fees: number;
  transactionDate: Date;
};

export type TrackedPositionInput = {
  mode: PositionTrackingMode;
  reconciliationBaseQuantity: number;
  reconciliationBaseCost: number;
  ledgerStartTransactionId: number | null;
  transactions: PositionLedgerTransaction[];
};

export type CalculatedPosition = {
  totalQuantity: number;
  averageCost: number;
  totalCost: number;
};

/**
 * Calcula a posição a partir do ledger integral ou de uma base conciliada.
 * Em modo reconciliado, somente transações posteriores ao marco alteram a base.
 */
export function calculateTrackedPosition(input: TrackedPositionInput): CalculatedPosition {
  const startFromReconciliation = input.mode === "reconciled";
  let totalQuantity = startFromReconciliation ? input.reconciliationBaseQuantity : 0;
  let totalCost = startFromReconciliation ? input.reconciliationBaseCost : 0;
  const minimumTransactionId = startFromReconciliation ? input.ledgerStartTransactionId ?? 0 : 0;

  const transactions = input.transactions
    .filter(transaction => transaction.id > minimumTransactionId)
    .sort((a, b) => {
      const dateDiff = a.transactionDate.getTime() - b.transactionDate.getTime();
      return dateDiff !== 0 ? dateDiff : a.id - b.id;
    });

  for (const transaction of transactions) {
    if (transaction.type === "buy") {
      totalQuantity += transaction.quantity;
      totalCost += transaction.quantity * transaction.unitPrice + transaction.fees;
      continue;
    }

    if (transaction.quantity > totalQuantity + 1e-8) {
      throw new Error("Venda excede a quantidade disponível na posição");
    }

    const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    totalQuantity -= transaction.quantity;
    totalCost = totalQuantity * averageCost;
  }

  const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
  return { totalQuantity, averageCost, totalCost };
}
