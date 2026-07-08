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

/**
 * Dividendos e proventos recebidos por ativo
 */
export const dividends = mysqlTable("dividends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId").notNull(),
  /** Tipo de provento */
  type: mysqlEnum("type", ["dividendo", "jcp", "rendimento", "amortizacao", "bonificacao", "outro"]).notNull(),
  /** Valor por cota/ação */
  valuePerShare: decimal("valuePerShare", { precision: 18, scale: 8 }).notNull(),
  /** Quantidade de cotas na data COM */
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  /** Valor total recebido */
  totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
  /** Moeda do provento */
  currency: mysqlEnum("currency", ["BRL", "USD"]).default("BRL").notNull(),
  /** Data COM (data de corte) */
  exDate: timestamp("exDate").notNull(),
  /** Data de pagamento */
  paymentDate: timestamp("paymentDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Dividend = typeof dividends.$inferSelect;
export type InsertDividend = typeof dividends.$inferInsert;

/**
 * Alertas de monitoramento de ativos
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId").notNull(),
  /** Tipo de alerta */
  type: mysqlEnum("type", [
    "price_drop",        // Queda percentual > threshold
    "price_rise",        // Alta percentual > threshold
    "below_avg_cost",    // Preço abaixo do custo médio
    "above_target",      // Preço acima do preço-alvo
    "below_target",      // Preço abaixo do preço-alvo
    "buy_opportunity",   // Preço < custo médio * (1 - margin)
    "news_alert",        // Alerta gerado por notícia de alto impacto
  ]).notNull(),
  /** Valor de referência (percentual ou preço) */
  threshold: decimal("threshold", { precision: 18, scale: 4 }).notNull(),
  /** Preço-alvo (para alertas de preço absoluto) */
  targetPrice: decimal("targetPrice", { precision: 18, scale: 8 }),
  /** Status do alerta */
  status: mysqlEnum("status", ["active", "triggered", "dismissed"]).default("active").notNull(),
  /** Mensagem gerada quando o alerta foi disparado */
  triggeredMessage: text("triggeredMessage"),
  /** Quando foi disparado */
  triggeredAt: timestamp("triggeredAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Histórico de análises de melhor compra geradas pela IA
 */
export const analysisHistory = mysqlTable("analysisHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Valor disponível informado pelo usuário */
  availableAmount: decimal("availableAmount", { precision: 18, scale: 2 }).notNull(),
  /** Foco da análise: brasil, eua ou todos */
  focus: mysqlEnum("focus", ["brasil", "eua", "todos"]).notNull(),
  /** Contexto adicional fornecido pelo usuário */
  userContext: text("userContext"),
  /** Texto completo da análise gerada pela IA (markdown) */
  analysisText: text("analysisText").notNull(),
  /** Ticker do ativo recomendado (extraído da análise) */
  recommendedTicker: varchar("recommendedTicker", { length: 32 }),
  /** Snapshot das cotações no momento da análise (JSON) */
  quotesSnapshot: text("quotesSnapshot"),
  /** Câmbio USD/BRL no momento da análise */
  usdBrl: decimal("usdBrl", { precision: 10, scale: 4 }),
  /** Número de ativos analisados */
  assetsAnalyzed: int("assetsAnalyzed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisHistory = typeof analysisHistory.$inferSelect;
export type InsertAnalysisHistory = typeof analysisHistory.$inferInsert;

/**
 * Notícias analisadas pela IA com impacto nos ativos da carteira
 */
export const newsItems = mysqlTable("newsItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Título da notícia */
  title: text("title").notNull(),
  /** Resumo da notícia gerado pela IA */
  summary: text("summary"),
  /** Análise de impacto gerada pela IA */
  impactAnalysis: text("impactAnalysis"),
  /** Fonte da notícia */
  source: varchar("source", { length: 100 }),
  /** URL da fonte original */
  sourceUrl: text("sourceUrl"),
  /** Categoria da notícia */
  category: mysqlEnum("category", ["brasil", "global", "cripto", "tech", "politica", "macro"]).default("global"),
  /** Nível de impacto nos ativos da carteira */
  impactLevel: mysqlEnum("impactLevel", ["alto", "medio", "baixo"]).default("baixo"),
  /** Sentimento: positivo, negativo ou neutro */
  sentiment: mysqlEnum("sentiment", ["positivo", "negativo", "neutro"]).default("neutro"),
  /** Previsão direcional do preço do ativo principal afetado */
  priceDirection: mysqlEnum("priceDirection", [
    "alta_forte",
    "alta_media",
    "alta_fraca",
    "neutro",
    "baixa_fraca",
    "baixa_media",
    "baixa_forte",
  ]).default("neutro"),
  /** Tickers afetados (JSON array string) */
  affectedTickers: text("affectedTickers"),
  /** Data de publicação da notícia */
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Se o usuário já leu */
  isRead: int("isRead").default(0).notNull(),
});

export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;

/**
 * Calendário de eventos corporativos (earnings, dividendos, splits, etc)
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId").notNull(),
  ticker: varchar("ticker", { length: 32 }).notNull(),
  /** Tipo de evento: earnings, dividendo, split, ipo, etc */
  eventType: mysqlEnum("eventType", [
    "earnings",
    "dividendo",
    "split",
    "ipo",
    "desdobramento",
    "agrupamento",
    "evento_corporativo",
    "outro",
  ]).notNull(),
  /** Descrição do evento */
  description: text("description"),
  /** Data do evento */
  eventDate: timestamp("eventDate").notNull(),
  /** Data de ex-direito (para dividendos) */
  exDate: timestamp("exDate"),
  /** Valor esperado (para dividendos, preço de split, etc) */
  expectedValue: decimal("expectedValue", { precision: 18, scale: 8 }),
  /** Unidade do valor (BRL, USD, %) */
  valueUnit: varchar("valueUnit", { length: 10 }).default("BRL"),
  /** Status: agendado, realizado, cancelado */
  status: mysqlEnum("status", ["agendado", "realizado", "cancelado"]).default("agendado"),
  /** Resultado real (preenchido após o evento) */
  actualResult: text("actualResult"),
  /** Notificação enviada ao usuário */
  notificationSent: int("notificationSent").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;


// ===== CAIXA =====

export const cashBalance = mysqlTable("cash_balance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CashBalance = typeof cashBalance.$inferSelect;
export type InsertCashBalance = typeof cashBalance.$inferInsert;

export const cashMovements = mysqlTable("cash_movements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["entrada", "saida"]).notNull(),
  category: mysqlEnum("category", [
    "dividendo_recebido",
    "vencimento_rf",
    "aporte_externo",
    "compra_ativo",
    "resgate",
    "taxa",
    "outro",
  ]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = typeof cashMovements.$inferInsert;

/**
 * Snapshot diário do patrimônio — capturado via cron (Manus Heartbeat) e/ou
 * manualmente. Um registro por usuário por dia (upsert por userId+snapshotDate).
 * classBreakdown: JSON string { [assetClass]: valueBRL }.
 */
export const portfolioSnapshots = mysqlTable("portfolio_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // "YYYY-MM-DD"
  totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
  totalCost: decimal("totalCost", { precision: 18, scale: 2 }).notNull(),
  cashBalance: decimal("cashBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  usdBrl: decimal("usdBrl", { precision: 10, scale: 4 }).notNull(),
  classBreakdown: text("classBreakdown"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;
