import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import {
  addTransactionAtomically,
  createImportFingerprint,
} from "./services/portfolioMutationService";

const assetFixture = {
  id: 42,
  userId: 7,
  ticker: "VALE3",
  name: "Vale",
  assetClass: "rv_nacional",
  currency: "BRL",
  positionTrackingMode: "ledger",
  reconciliationBaseQuantity: "0",
  reconciliationBaseCost: "0",
  ledgerStartTransactionId: null,
  totalQuantity: "0",
  averageCost: "0",
  totalCost: "0",
  lastPrice: "0",
  lastPriceUpdatedAt: null,
  issuer: null,
  maturityDate: null,
  maturityLabel: null,
  priceReferenceDate: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function lockedSelect(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        for: () => ({ limit: async () => rows }),
      }),
    }),
  };
}

function ledgerSelect(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({ orderBy: async () => rows }),
    }),
  };
}

describe("fingerprint de importação CSV", () => {
  const base = {
    ticker: "VALE3",
    type: "buy" as const,
    quantity: 10,
    price: 55.2,
    totalCost: 552,
    fees: 0,
    date: "2026-10-21",
    assetClass: "rv_nacional",
    sourceLine: 2,
  };

  it("repete a chave para a mesma operação", () => {
    expect(createImportFingerprint("xp", base)).toBe(createImportFingerprint("xp", { ...base, sourceLine: 9 }));
  });

  it("diferencia operações legítimas no mesmo dia", () => {
    const sameDayDifferentTicker = createImportFingerprint("xp", { ...base, ticker: "PETR4" });
    const sameDayDifferentPrice = createImportFingerprint("xp", { ...base, price: 55.3, totalCost: 553 });
    const baseFingerprint = createImportFingerprint("xp", base);

    expect(sameDayDifferentTicker).not.toBe(baseFingerprint);
    expect(sameDayDifferentPrice).not.toBe(baseFingerprint);
  });
});

describe("addTransactionAtomically", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("recusa venda sem posição e não cria ativo ou transação", async () => {
    const tx = {
      select: vi.fn(() => lockedSelect([])),
      insert: vi.fn(),
      update: vi.fn(),
    };
    mocks.getDb.mockResolvedValue({ transaction: async (callback: (executor: unknown) => unknown) => callback(tx) });

    await expect(addTransactionAtomically({
      userId: 7,
      ticker: "VALE3",
      name: "Vale",
      assetClass: "rv_nacional",
      currency: "BRL",
      type: "sell",
      quantity: 1,
      unitPrice: 50,
      fees: 0,
      transactionDate: new Date("2026-10-21T12:00:00Z"),
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Ativo VALE3 não possui posição para venda" });

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("insere e recalcula uma compra válida dentro da mesma transação", async () => {
    const transactionValues = vi.fn().mockResolvedValue(undefined);
    const positionWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      select: vi.fn()
        .mockImplementationOnce(() => lockedSelect([assetFixture]))
        .mockImplementationOnce(() => ledgerSelect([])),
      insert: vi.fn(() => ({ values: transactionValues })),
      update: vi.fn(() => ({ set: () => ({ where: positionWhere }) })),
    };
    mocks.getDb.mockResolvedValue({ transaction: async (callback: (executor: unknown) => unknown) => callback(tx) });

    const result = await addTransactionAtomically({
      userId: 7,
      ticker: "VALE3",
      name: "Vale",
      assetClass: "rv_nacional",
      currency: "BRL",
      type: "buy",
      quantity: 2,
      unitPrice: 50,
      fees: 1,
      transactionDate: new Date("2026-10-21T12:00:00Z"),
    });

    expect(result).toMatchObject({ assetId: 42, totalQuantity: 2, averageCost: 50.5, totalCost: 101 });
    expect(transactionValues).toHaveBeenCalledOnce();
    expect(positionWhere).toHaveBeenCalledOnce();
  });
});
