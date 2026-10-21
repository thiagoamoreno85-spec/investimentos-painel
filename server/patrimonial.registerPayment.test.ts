import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { patrimonialRouter } from "./routers/patrimonial";

const context: TrpcContext = {
  user: {
    id: 7,
    openId: "integrity-test-user",
    name: "Integrity Test",
    email: null,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const liability = {
  id: 12,
  userId: 7,
  assetId: null,
  name: "Financiamento",
  creditor: null,
  originalAmount: "100.00",
  remainingBalance: "100.00",
  installmentValue: null,
  totalInstallments: null,
  paidInstallments: 2,
  interestRate: null,
  startDate: new Date(),
  endDate: null,
  notes: null,
  isActive: 1,
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

describe("patrimonial.registerPayment — transação", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("trava o passivo, grava o pagamento e atualiza o saldo na mesma transação", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      select: vi.fn(() => lockedSelect([liability])),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
    };
    mocks.getDb.mockResolvedValue({ transaction: async (callback: (executor: unknown) => unknown) => callback(tx) });

    const caller = patrimonialRouter.createCaller(context);
    const result = await caller.registerPayment({
      liabilityId: 12,
      amount: 25,
      paymentDate: new Date("2026-10-21T12:00:00Z"),
      installmentNumber: 3,
    });

    expect(result).toEqual({ success: true, newBalance: 75 });
    expect(tx.select).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, liabilityId: 12, amount: "25.00" }));
    expect(updateWhere).toHaveBeenCalledOnce();
  });

  it("recusa sobrepagamento antes de inserir ou atualizar", async () => {
    const insertValues = vi.fn();
    const updateWhere = vi.fn();
    const tx = {
      select: vi.fn(() => lockedSelect([{ ...liability, remainingBalance: "10.00" }])),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
    };
    mocks.getDb.mockResolvedValue({ transaction: async (callback: (executor: unknown) => unknown) => callback(tx) });

    const caller = patrimonialRouter.createCaller(context);
    await expect(caller.registerPayment({
      liabilityId: 12,
      amount: 10.01,
      paymentDate: new Date("2026-10-21T12:00:00Z"),
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Valor do pagamento excede o saldo remanescente" });

    expect(insertValues).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("não escreve quando o passivo não é do usuário autenticado", async () => {
    const insertValues = vi.fn();
    const updateWhere = vi.fn();
    const tx = {
      select: vi.fn(() => lockedSelect([])),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
    };
    mocks.getDb.mockResolvedValue({ transaction: async (callback: (executor: unknown) => unknown) => callback(tx) });

    const caller = patrimonialRouter.createCaller(context);
    await expect(caller.registerPayment({
      liabilityId: 999,
      amount: 1,
      paymentDate: new Date("2026-10-21T12:00:00Z"),
    })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Passivo não encontrado" });

    expect(insertValues).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });
});
