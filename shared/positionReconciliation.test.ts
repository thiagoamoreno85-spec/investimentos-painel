import { describe, expect, it } from "vitest";
import { calculateTrackedPosition } from "./positionReconciliation";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`);

describe("calculateTrackedPosition", () => {
  it("reconstrói uma posição integralmente a partir do ledger", () => {
    const result = calculateTrackedPosition({
      mode: "ledger",
      reconciliationBaseQuantity: 0,
      reconciliationBaseCost: 0,
      ledgerStartTransactionId: null,
      transactions: [
        { id: 1, type: "buy", quantity: 10, unitPrice: 10, fees: 2, transactionDate: at(1) },
        { id: 2, type: "sell", quantity: 4, unitPrice: 12, fees: 0, transactionDate: at(2) },
      ],
    });

    expect(result.totalQuantity).toBe(6);
    expect(result.averageCost).toBe(10.2);
    expect(result.totalCost).toBe(61.2);
  });

  it("preserva a base conciliada e usa somente ajustes posteriores", () => {
    const result = calculateTrackedPosition({
      mode: "reconciled",
      reconciliationBaseQuantity: 100,
      reconciliationBaseCost: 1_000,
      ledgerStartTransactionId: 5,
      transactions: [
        { id: 1, type: "buy", quantity: 50, unitPrice: 3, fees: 0, transactionDate: at(1) },
        { id: 6, type: "buy", quantity: 20, unitPrice: 12, fees: 4, transactionDate: at(2) },
      ],
    });

    expect(result.totalQuantity).toBe(120);
    expect(result.totalCost).toBe(1_244);
    expect(result.averageCost).toBeCloseTo(10.36666667, 8);
  });

  it("reduz venda posterior preservando o custo médio da base conciliada", () => {
    const result = calculateTrackedPosition({
      mode: "reconciled",
      reconciliationBaseQuantity: 100,
      reconciliationBaseCost: 1_000,
      ledgerStartTransactionId: 5,
      transactions: [
        { id: 6, type: "sell", quantity: 25, unitPrice: 15, fees: 0, transactionDate: at(2) },
      ],
    });

    expect(result.totalQuantity).toBe(75);
    expect(result.averageCost).toBe(10);
    expect(result.totalCost).toBe(750);
  });

  it("impede venda acima da posição disponível", () => {
    expect(() => calculateTrackedPosition({
      mode: "reconciled",
      reconciliationBaseQuantity: 1,
      reconciliationBaseCost: 10,
      ledgerStartTransactionId: 0,
      transactions: [
        { id: 1, type: "sell", quantity: 2, unitPrice: 10, fees: 0, transactionDate: at(1) },
      ],
    })).toThrow("Venda excede a quantidade disponível na posição");
  });
});
