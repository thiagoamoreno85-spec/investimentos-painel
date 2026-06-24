import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, assets, transactions, InsertAsset, InsertTransaction, analysisHistory, InsertAnalysisHistory, newsItems, InsertNewsItem, events, InsertEvent } from "../drizzle/schema";
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

export async function getTransactionsByUserPaginated(userId: number, page: number, limit: number) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page, totalPages: 0 };
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql`COUNT(*)` }).from(transactions)
      .where(eq(transactions.userId, userId)),
  ]);
  const total = Number((countResult[0] as { count: number }).count);
  return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
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

// ========== ANALYSIS HISTORY ==========

export async function createAnalysisHistory(data: InsertAnalysisHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analysisHistory).values(data);
  return result[0].insertId;
}

export async function getAnalysisHistoryByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analysisHistory)
    .where(eq(analysisHistory.userId, userId))
    .orderBy(desc(analysisHistory.createdAt))
    .limit(limit);
}

export async function getAnalysisHistoryById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(analysisHistory)
    .where(and(eq(analysisHistory.id, id), eq(analysisHistory.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteAnalysisHistory(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(analysisHistory)
    .where(and(eq(analysisHistory.id, id), eq(analysisHistory.userId, userId)));
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

// ========== NEWS ITEMS ==========

export async function createNewsItem(data: InsertNewsItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(newsItems).values(data);
  return result[0].insertId;
}

export async function getNewsItemsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(newsItems)
    .where(eq(newsItems.userId, userId))
    .orderBy(desc(newsItems.createdAt))
    .limit(limit);
}

export async function markNewsItemRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(newsItems)
    .set({ isRead: 1 })
    .where(and(eq(newsItems.id, id), eq(newsItems.userId, userId)));
}

export async function markAllNewsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(newsItems)
    .set({ isRead: 1 })
    .where(eq(newsItems.userId, userId));
}

export async function countUnreadNews(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(newsItems)
    .where(and(eq(newsItems.userId, userId), eq(newsItems.isRead, 0)));
  return rows.length;
}

export async function deleteOldNewsItems(userId: number, keepLast = 100) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(newsItems)
    .where(eq(newsItems.userId, userId))
    .orderBy(desc(newsItems.createdAt))
    .limit(keepLast + 50);
  if (rows.length > keepLast) {
    const toDelete = rows.slice(keepLast);
    for (const row of toDelete) {
      await db.delete(newsItems).where(eq(newsItems.id, row.id));
    }
  }
}


// ========== EVENTS ==========

export async function createEvent(data: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(events).values(data);
  return result[0].insertId;
}

export async function getEventsByUser(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events)
    .where(eq(events.userId, userId))
    .orderBy(events.eventDate);
}

export async function getEventsByAsset(assetId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events)
    .where(and(eq(events.assetId, assetId), eq(events.userId, userId)))
    .orderBy(events.eventDate);
}

export async function getEventsByMonth(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // Fetch all events for the user and filter in JS
  const allEvents = await db.select().from(events)
    .where(eq(events.userId, userId))
    .orderBy(events.eventDate);
  
  return allEvents.filter(event => {
    const eventDate = new Date(event.eventDate);
    return eventDate >= startDate && eventDate <= endDate;
  });
}

export async function getEventById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateEvent(id: number, userId: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events)
    .set(data)
    .where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function deleteEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function getUpcomingEvents(userId: number, daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return db.select().from(events)
    .where(and(
      eq(events.userId, userId),
      eq(events.status, "agendado")
    ))
    .orderBy(events.eventDate);
}
