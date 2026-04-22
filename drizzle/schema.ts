import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Ativos da carteira - cada ativo tem ticker, classe, e valores calculados
 */
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  assetClass: mysqlEnum("assetClass", [
    "rv_nacional",
    "rv_eua",
    "fundos",
    "cripto",
    "renda_fixa",
    "uranio",
    "india",
    "caixa",
  ]).notNull(),
  currency: mysqlEnum("currency", ["BRL", "USD"]).default("BRL").notNull(),
  /** Quantidade total atual (calculada a partir das transações) */
  totalQuantity: decimal("totalQuantity", { precision: 18, scale: 8 }).default("0").notNull(),
  /** Custo médio ponderado (calculado a partir das transações) */
  averageCost: decimal("averageCost", { precision: 18, scale: 8 }).default("0").notNull(),
  /** Custo total investido (soma de todas as compras - vendas) */
  totalCost: decimal("totalCost", { precision: 18, scale: 2 }).default("0").notNull(),
  /** Último preço de mercado (atualizado via cotações) */
  lastPrice: decimal("lastPrice", { precision: 18, scale: 8 }).default("0").notNull(),
  /** Timestamp da última atualização de preço */
  lastPriceUpdatedAt: timestamp("lastPriceUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

/**
 * Transações de compra e venda de ativos
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId").notNull(),
  type: mysqlEnum("type", ["buy", "sell"]).notNull(),
  /** Quantidade comprada ou vendida */
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  /** Preço unitário na transação */
  unitPrice: decimal("unitPrice", { precision: 18, scale: 8 }).notNull(),
  /** Valor total da transação (quantity * unitPrice) */
  totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
  /** Taxa de corretagem / emolumentos */
  fees: decimal("fees", { precision: 18, scale: 2 }).default("0").notNull(),
  /** Data da transação */
  transactionDate: timestamp("transactionDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
