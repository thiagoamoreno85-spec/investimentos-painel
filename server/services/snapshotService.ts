/**
 * Serviço de snapshot diário do patrimônio — compartilhado entre a mutation
 * tRPC (captura manual) e o endpoint Heartbeat (/api/scheduled/portfolio-snapshot).
 *
 * Um snapshot por usuário por dia: se já existir para a data, é atualizado
 * (última captura do dia vence).
 */
import { and, eq, gte } from "drizzle-orm";
import { getDb, getAssetsByUser } from "../db";
import { portfolioSnapshots, cashBalance } from "../../drizzle/schema";
import { fetchUsdBrl } from "../quotes";

const USD_CLASSES = ["rv_eua", "cripto", "uranio", "india"];

export interface SnapshotResult {
  snapshotDate: string;
  totalValue: number;
  totalCost: number;
  cash: number;
  usdBrl: number;
  classBreakdown: Record<string, number>;
  updated: boolean;
}

/** Calcula e persiste o snapshot de hoje para um usuário. */
export async function captureSnapshot(userId: number): Promise<SnapshotResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const assets = await getAssetsByUser(userId);
  const usdBrl = await fetchUsdBrl().catch(() => 5.7);

  const cashRows = await db
    .select()
    .from(cashBalance)
    .where(eq(cashBalance.userId, userId))
    .limit(1);
  const cash = cashRows.length > 0 ? Number(cashRows[0].balance) : 0;

  const classBreakdown: Record<string, number> = {};
  let totalValue = cash;
  let totalCost = 0;

  if (cash > 0) classBreakdown["caixa"] = cash;

  for (const asset of assets) {
    if (asset.assetClass === "caixa") continue;
    const qty = parseFloat(asset.totalQuantity || "0");
    const price = parseFloat(asset.lastPrice || asset.averageCost || "0");
    const avgCost = parseFloat(asset.averageCost || "0");
    const fx = USD_CLASSES.includes(asset.assetClass) ? usdBrl : 1;

    const valueBRL = qty * price * fx;
    totalValue += valueBRL;
    totalCost += qty * avgCost * fx;
    classBreakdown[asset.assetClass] =
      (classBreakdown[asset.assetClass] ?? 0) + valueBRL;
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);

  const existing = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        eq(portfolioSnapshots.snapshotDate, snapshotDate)
      )
    )
    .limit(1);

  const values = {
    totalValue: totalValue.toFixed(2),
    totalCost: totalCost.toFixed(2),
    cashBalance: cash.toFixed(2),
    usdBrl: usdBrl.toFixed(4),
    classBreakdown: JSON.stringify(classBreakdown),
  };

  let updated = false;
  if (existing.length > 0) {
    await db
      .update(portfolioSnapshots)
      .set(values)
      .where(eq(portfolioSnapshots.id, existing[0].id));
    updated = true;
  } else {
    await db.insert(portfolioSnapshots).values({
      userId,
      snapshotDate,
      ...values,
    });
  }

  return {
    snapshotDate,
    totalValue,
    totalCost,
    cash,
    usdBrl,
    classBreakdown,
    updated,
  };
}

/** Histórico de snapshots dos últimos `days` dias, em ordem cronológica. */
export async function getSnapshotHistory(userId: number, days: number = 365) {
  const db = await getDb();
  if (!db) return [];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        gte(portfolioSnapshots.snapshotDate, fromStr)
      )
    )
    .orderBy(portfolioSnapshots.snapshotDate);

  return rows.map((r) => ({
    date: r.snapshotDate,
    totalValue: Number(r.totalValue),
    totalCost: Number(r.totalCost),
    cash: Number(r.cashBalance),
    classBreakdown: r.classBreakdown
      ? (JSON.parse(r.classBreakdown) as Record<string, number>)
      : {},
  }));
}
