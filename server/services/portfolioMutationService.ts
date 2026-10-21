import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assets, transactions } from "../../drizzle/schema";
import { getDb } from "../db";
import { calculateTrackedPosition } from "../../shared/positionReconciliation";
import type { ParsedTransaction } from "../lib/csvParser";

const ASSET_CLASSES = [
  "rv_nacional",
  "rv_eua",
  "fundos",
  "cripto",
  "renda_fixa",
  "uranio",
  "india",
  "caixa",
] as const;

type AssetClass = (typeof ASSET_CLASSES)[number];
type TransactionType = "buy" | "sell";

export type ManualTransactionInput = {
  userId: number;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  currency: "BRL" | "USD";
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  transactionDate: Date;
  notes?: string;
};

type ImportedCandidate = ParsedTransaction & { importFingerprint: string };

function toTrpcError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  console.error("[portfolioMutation] Falha transacional:", error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Não foi possível concluir a operação. Nenhuma alteração foi gravada.",
  });
}

function invalid(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function normalizeTicker(value: string) {
  const ticker = value.trim().toUpperCase();
  if (!ticker || ticker.length > 32) invalid("Ticker inválido");
  return ticker;
}

function assertFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) invalid(`${label} deve ser positivo`);
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) invalid(`${label} não pode ser negativo`);
}

function normalizeDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) invalid("Data da operação inválida");
  return value;
}

function isUsdAssetClass(assetClass: AssetClass) {
  return ["rv_eua", "cripto", "uranio", "india"].includes(assetClass);
}

function assetInsertValues(input: {
  userId: number;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  currency: "BRL" | "USD";
}) {
  return {
    userId: input.userId,
    ticker: input.ticker,
    name: input.name.trim().slice(0, 128) || input.ticker,
    assetClass: input.assetClass,
    currency: input.currency,
    totalQuantity: "0",
    averageCost: "0",
    totalCost: "0",
    lastPrice: "0",
    archivedAt: null,
  };
}

async function getOrCreateLockedAsset(
  tx: any,
  input: {
    userId: number;
    ticker: string;
    name: string;
    assetClass: AssetClass;
    currency: "BRL" | "USD";
    allowCreate: boolean;
  },
) {
  let rows = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.userId, input.userId), eq(assets.ticker, input.ticker)))
    .for("update")
    .limit(1);

  if (rows[0]) return rows[0];
  if (!input.allowCreate) invalid(`Ativo ${input.ticker} não possui posição para venda`);

  await tx
    .insert(assets)
    .values(assetInsertValues(input))
    .onDuplicateKeyUpdate({ set: { ticker: input.ticker } });

  rows = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.userId, input.userId), eq(assets.ticker, input.ticker)))
    .for("update")
    .limit(1);

  if (!rows[0]) {
    throw new Error("Ativo não disponível após criação idempotente");
  }
  return rows[0];
}

async function getLedgerTransactions(tx: any, assetId: number, userId: number) {
  return tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.assetId, assetId), eq(transactions.userId, userId)))
    .orderBy(asc(transactions.transactionDate), asc(transactions.id));
}

function calculateProjectedPosition(
  asset: typeof assets.$inferSelect,
  ledgerRows: (typeof transactions.$inferSelect)[],
  candidates: Array<{ type: TransactionType; quantity: number; unitPrice: number; fees: number; transactionDate: Date; order: number }>,
) {
  const projected = [
    ...ledgerRows.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      fees: Number(row.fees),
      transactionDate: row.transactionDate,
    })),
    ...candidates.map((row, index) => ({
      id: Number.MAX_SAFE_INTEGER - candidates.length + index + 1,
      type: row.type,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      fees: row.fees,
      transactionDate: row.transactionDate,
    })),
  ];

  try {
    return calculateTrackedPosition({
      mode: asset.positionTrackingMode,
      reconciliationBaseQuantity: Number(asset.reconciliationBaseQuantity),
      reconciliationBaseCost: Number(asset.reconciliationBaseCost),
      ledgerStartTransactionId: asset.ledgerStartTransactionId ?? null,
      transactions: projected,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Venda excede")) {
      invalid("Venda excede a quantidade disponível na posição");
    }
    throw error;
  }
}

async function persistCalculatedPosition(tx: any, assetId: number, userId: number, calculation: ReturnType<typeof calculateTrackedPosition>, reactivate: boolean) {
  await tx
    .update(assets)
    .set({
      totalQuantity: calculation.totalQuantity.toFixed(8),
      averageCost: calculation.averageCost.toFixed(8),
      totalCost: calculation.totalCost.toFixed(2),
      ...(reactivate ? { archivedAt: null } : {}),
    })
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
}

export async function addTransactionAtomically(input: ManualTransactionInput) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

  const ticker = normalizeTicker(input.ticker);
  assertFinitePositive(input.quantity, "Quantidade");
  assertFinitePositive(input.unitPrice, "Preço unitário");
  assertFiniteNonNegative(input.fees, "Taxa");
  const transactionDate = normalizeDate(input.transactionDate);

  try {
    return await db.transaction(async (tx) => {
      const asset = await getOrCreateLockedAsset(tx, {
        userId: input.userId,
        ticker,
        name: input.name,
        assetClass: input.assetClass,
        currency: input.currency,
        allowCreate: input.type === "buy",
      });
      const ledgerRows = await getLedgerTransactions(tx, asset.id, input.userId);
      const calculation = calculateProjectedPosition(asset, ledgerRows, [{
        type: input.type,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        fees: input.fees,
        transactionDate,
        order: 0,
      }]);

      await tx.insert(transactions).values({
        userId: input.userId,
        assetId: asset.id,
        type: input.type,
        quantity: input.quantity.toFixed(8),
        unitPrice: input.unitPrice.toFixed(8),
        totalValue: (input.quantity * input.unitPrice).toFixed(2),
        fees: input.fees.toFixed(2),
        transactionDate,
        notes: input.notes?.trim() || null,
        importFingerprint: null,
      });
      await persistCalculatedPosition(tx, asset.id, input.userId, calculation, input.type === "buy");

      return {
        assetId: asset.id,
        totalQuantity: calculation.totalQuantity,
        averageCost: calculation.averageCost,
        totalCost: calculation.totalCost,
      };
    });
  } catch (error) {
    return toTrpcError(error);
  }
}

export async function deleteTransactionAtomically(transactionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

  try {
    return await db.transaction(async (tx) => {
      const txRows = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
        .for("update")
        .limit(1);
      const transaction = txRows[0];
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transação não encontrada" });

      const assetRows = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, transaction.assetId), eq(assets.userId, userId)))
        .for("update")
        .limit(1);
      const asset = assetRows[0];
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Ativo da transação não encontrado" });
      if (asset.positionTrackingMode === "reconciled" && transaction.id <= (asset.ledgerStartTransactionId ?? 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transação anterior ao marco de conciliação não pode ser removida sem nova reconciliação",
        });
      }

      const ledgerRows = await getLedgerTransactions(tx, asset.id, userId);
      const remainingRows = (ledgerRows as Array<typeof transactions.$inferSelect>).filter((row) => row.id !== transaction.id);
      const calculation = calculateProjectedPosition(asset, remainingRows, []);

      await tx.delete(transactions).where(and(eq(transactions.id, transaction.id), eq(transactions.userId, userId)));
      await persistCalculatedPosition(tx, asset.id, userId, calculation, false);
      return {
        totalQuantity: calculation.totalQuantity,
        averageCost: calculation.averageCost,
        totalCost: calculation.totalCost,
      };
    });
  } catch (error) {
    return toTrpcError(error);
  }
}

export async function archiveAssetAtomically(assetId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
        .for("update")
        .limit(1);
      const asset = rows[0];
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Ativo não encontrado" });
      const ledgerRows = await getLedgerTransactions(tx, asset.id, userId);
      const calculation = calculateProjectedPosition(asset, ledgerRows, []);
      if (calculation.totalQuantity > 1e-8) {
        invalid("Ativos com posição aberta não podem ser arquivados");
      }
      await tx
        .update(assets)
        .set({ archivedAt: new Date() })
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
    });
    return { success: true };
  } catch (error) {
    return toTrpcError(error);
  }
}

function normalizedNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
}

export function createImportFingerprint(format: string, transaction: ParsedTransaction) {
  const canonical = [
    format.toLowerCase(),
    transaction.ticker.trim().toUpperCase(),
    transaction.type,
    transaction.date,
    normalizedNumber(transaction.quantity, 8),
    normalizedNumber(transaction.price, 8),
    normalizedNumber(transaction.fees ?? 0, 2),
    normalizedNumber(transaction.totalCost, 2),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export async function importTransactionsAtomically(input: {
  userId: number;
  format: string;
  transactions: ParsedTransaction[];
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

  const seen = new Set<string>();
  const candidates: ImportedCandidate[] = [];
  let skippedDuplicate = 0;
  for (const transaction of input.transactions) {
    const importFingerprint = createImportFingerprint(input.format, transaction);
    if (seen.has(importFingerprint)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(importFingerprint);
    candidates.push({ ...transaction, importFingerprint });
  }

  try {
    return await db.transaction(async (tx) => {
      if (candidates.length === 0) {
        return { imported: 0, skippedDuplicate, total: input.transactions.length, format: input.format };
      }

      const existingFingerprints = await tx
        .select({ importFingerprint: transactions.importFingerprint })
        .from(transactions)
        .where(and(
          eq(transactions.userId, input.userId),
          inArray(transactions.importFingerprint, candidates.map((candidate) => candidate.importFingerprint)),
        ));
      const existing = new Set(existingFingerprints.map((row) => row.importFingerprint).filter(Boolean));
      const toImport = candidates.filter((candidate) => !existing.has(candidate.importFingerprint));
      skippedDuplicate += candidates.length - toImport.length;
      if (toImport.length === 0) {
        return { imported: 0, skippedDuplicate, total: input.transactions.length, format: input.format };
      }

      const grouped = new Map<string, ImportedCandidate[]>();
      for (const candidate of toImport) {
        const ticker = normalizeTicker(candidate.ticker);
        const entries = grouped.get(ticker) ?? [];
        entries.push({ ...candidate, ticker });
        grouped.set(ticker, entries);
      }

      const prepared: Array<{
        asset: typeof assets.$inferSelect;
        rows: ImportedCandidate[];
        calculation: ReturnType<typeof calculateTrackedPosition>;
      }> = [];

      for (const ticker of Array.from(grouped.keys()).sort()) {
        const rows = grouped.get(ticker) ?? [];
        const first = rows[0];
        const assetClass = first.assetClass as AssetClass;
        if (!ASSET_CLASSES.includes(assetClass)) invalid(`Classe de ativo inválida para ${ticker}`);
        const asset = await getOrCreateLockedAsset(tx, {
          userId: input.userId,
          ticker,
          name: ticker,
          assetClass,
          currency: isUsdAssetClass(assetClass) ? "USD" : "BRL",
          allowCreate: rows.some((row) => row.type === "buy"),
        });
        const ledgerRows = await getLedgerTransactions(tx, asset.id, input.userId);
        const calculation = calculateProjectedPosition(asset, ledgerRows, rows
          .sort((a, b) => a.date.localeCompare(b.date) || a.sourceLine - b.sourceLine)
          .map((row, order) => ({
            type: row.type,
            quantity: row.quantity,
            unitPrice: row.price,
            fees: row.fees ?? 0,
            transactionDate: new Date(`${row.date}T12:00:00.000Z`),
            order,
          })));
        prepared.push({ asset, rows, calculation });
      }

      for (const entry of prepared) {
        const reactivate = entry.rows.some((row) => row.type === "buy");
        for (const row of entry.rows) {
          await tx.insert(transactions).values({
            userId: input.userId,
            assetId: entry.asset.id,
            type: row.type,
            quantity: row.quantity.toFixed(8),
            unitPrice: row.price.toFixed(8),
            totalValue: row.totalCost.toFixed(2),
            fees: (row.fees ?? 0).toFixed(2),
            transactionDate: new Date(`${row.date}T12:00:00.000Z`),
            notes: `Importação CSV ${input.format.toUpperCase()} · linha ${row.sourceLine}`,
            importFingerprint: row.importFingerprint,
          });
        }
        await persistCalculatedPosition(tx, entry.asset.id, input.userId, entry.calculation, reactivate);
      }

      return { imported: toImport.length, skippedDuplicate, total: input.transactions.length, format: input.format };
    });
  } catch (error) {
    return toTrpcError(error);
  }
}
