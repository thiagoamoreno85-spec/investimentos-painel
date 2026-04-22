import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, assets, transactions, InsertAsset, InsertTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== ASSETS ==========

export async function getAssetsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(eq(assets.userId, userId));
}

export async function getAssetById(assetId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAssetByTicker(ticker: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assets)
    .where(and(eq(assets.ticker, ticker), eq(assets.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAsset(data: InsertAsset) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(assets).values(data);
  return result[0].insertId;
}

export async function updateAssetCalculations(assetId: number, totalQuantity: string, averageCost: string, totalCost: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets)
    .set({ totalQuantity, averageCost, totalCost })
    .where(eq(assets.id, assetId));
}

export async function updateAssetPrice(assetId: number, lastPrice: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets)
    .set({ lastPrice, lastPriceUpdatedAt: new Date() })
    .where(eq(assets.id, assetId));
}

export async function updateAssetPricesBulk(updates: { id: number; lastPrice: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const u of updates) {
    await db.update(assets)
      .set({ lastPrice: u.lastPrice, lastPriceUpdatedAt: new Date() })
      .where(eq(assets.id, u.id));
  }
}

export async function deleteAsset(assetId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(eq(transactions.assetId, assetId));
  await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
}

// ========== TRANSACTIONS ==========

export async function getTransactionsByAsset(assetId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions)
    .where(and(eq(transactions.assetId, assetId), eq(transactions.userId, userId)))
    .orderBy(desc(transactions.transactionDate));
}

export async function getTransactionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.transactionDate));
}

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data);
  return result[0].insertId;
}

export async function deleteTransaction(txId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(and(eq(transactions.id, txId), eq(transactions.userId, userId)));
}

/**
 * Recalcula preço médio e quantidade total de um ativo com base em todas as transações
 */
export async function recalculateAsset(assetId: number, userId: number) {
  const txs = await getTransactionsByAsset(assetId, userId);
  
  let totalQty = 0;
  let totalCostAccum = 0;

  const sorted = [...txs].sort((a, b) => 
    new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
  );

  for (const tx of sorted) {
    const qty = parseFloat(tx.quantity);
    const price = parseFloat(tx.unitPrice);
    const fees = parseFloat(tx.fees);

    if (tx.type === "buy") {
      totalCostAccum += qty * price + fees;
      totalQty += qty;
    } else {
      if (totalQty > 0) {
        const avgCost = totalCostAccum / totalQty;
        totalQty -= qty;
        totalCostAccum = totalQty * avgCost;
      }
    }
  }

  const avgCost = totalQty > 0 ? totalCostAccum / totalQty : 0;

  await updateAssetCalculations(
    assetId,
    totalQty.toFixed(8),
    avgCost.toFixed(8),
    totalCostAccum.toFixed(2)
  );

  return { totalQuantity: totalQty, averageCost: avgCost, totalCost: totalCostAccum };
}
