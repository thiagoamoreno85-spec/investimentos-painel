import { getDb } from "../db";
import { assets, cashBalance, portfolioSnapshots } from "../../drizzle/schema";
import type { PortfolioSnapshot } from "../../drizzle/schema";
import { eq, and, desc, lte } from "drizzle-orm";
import { fetchUsdBrl } from "../quotes";
import { DEFAULT_USD_BRL_RATE } from "../../shared/constants";

const CLASS_CURRENCY: Record<string, string> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
  caixa: "BRL",
};

export async function captureSnapshot(
  userId: number
): Promise<{ success: boolean; totalValueBRL: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userAssets = await db.select().from(assets).where(eq(assets.userId, userId));
  const cashRows = await db
    .select()
    .from(cashBalance)
    .where(eq(cashBalance.userId, userId))
    .limit(1);
  const cash = Number(cashRows[0]?.balance ?? 0);

  const usdBrl = await fetchUsdBrl().catch(() => DEFAULT_USD_BRL_RATE);

  let totalValueBRL = cash;
  let totalCostBRL = 0;
  const classValues: Record<string, number> = {};
  const classCosts: Record<string, number> = {};

  for (const asset of userAssets) {
    if (asset.assetClass === "caixa") continue;

    const qty = parseFloat(asset.totalQuantity);
    const lastPrice = parseFloat(asset.lastPrice);
    const avgCost = parseFloat(asset.averageCost);
    const currency = asset.currency || CLASS_CURRENCY[asset.assetClass] || "BRL";
    const fx = currency === "USD" ? usdBrl : 1;

    const valueBRL = qty * lastPrice * fx;
    const costBRL = qty * avgCost * fx;

    totalValueBRL += valueBRL;
    totalCostBRL += costBRL;

    const cls = asset.assetClass;
    classValues[cls] = (classValues[cls] || 0) + valueBRL;
    classCosts[cls] = (classCosts[cls] || 0) + costBRL;
  }

  // Adicionar caixa às classes
  if (cash > 0) {
    classValues["caixa"] = (classValues["caixa"] || 0) + cash;
  }

  // Usar meia-noite do dia atual como snapshotDate
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Verificar se já existe snapshot para hoje (evitar duplicatas)
  const existing = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        eq(portfolioSnapshots.snapshotDate, today)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Atualizar o snapshot existente
    await db
      .update(portfolioSnapshots)
      .set({
        totalValueBRL: totalValueBRL.toFixed(2),
        totalCostBRL: totalCostBRL.toFixed(2),
        cashBRL: cash.toFixed(2),
        usdBrlRate: usdBrl.toFixed(4),
        classValuesJSON: JSON.stringify(classValues),
        classCostsJSON: JSON.stringify(classCosts),
      })
      .where(eq(portfolioSnapshots.id, existing[0].id));
  } else {
    await db.insert(portfolioSnapshots).values({
      userId,
      snapshotDate: today,
      totalValueBRL: totalValueBRL.toFixed(2),
      totalCostBRL: totalCostBRL.toFixed(2),
      cashBRL: cash.toFixed(2),
      usdBrlRate: usdBrl.toFixed(4),
      classValuesJSON: JSON.stringify(classValues),
      classCostsJSON: JSON.stringify(classCosts),
    });
  }

  return { success: true, totalValueBRL };
}

export async function getSnapshotByDate(
  userId: number,
  date: Date
): Promise<PortfolioSnapshot | null> {
  const db = await getDb();
  if (!db) return null;

  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  // Buscar o snapshot mais recente até a data solicitada (inclusive)
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        lte(portfolioSnapshots.snapshotDate, targetDate)
      )
    )
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestSnapshots(
  userId: number,
  limit: number = 30
): Promise<PortfolioSnapshot[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.userId, userId))
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(limit);
}
