import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  captureSnapshot as captureSnapshotService,
  getSnapshotHistory as getSnapshotHistoryService,
  getSnapshotByDate,
  getLastSnapshotOfPreviousMonth,
} from "../services/snapshotService";
import {
  getAssetsByUser,
  getAssetById,
  getAssetByTicker,
  createAsset,
  createTransaction,
  getTransactionsByUser,
  getTransactionsByAsset,
  updateAssetPrice,
  createEvent,
  getEventsByUser,
  getEventsByAsset,
  getEventsByMonth,
  getEventById,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
} from "../db";
import { fetchQuotes, fetchUsdBrl } from "../quotes";
import {
  captureDailyPerformanceSnapshot,
  getLiveDailyPerformance,
  getMonthlyPerformance,
  getMonthlyPerformanceDetails,
} from "../services/dailyPerformanceService";
import { resolveValuationFxRateForUser } from "../services/valuationFxService";
import { DEFAULT_USD_BRL_RATE } from "../../shared/constants";
import { assets, transactions as transactionsTable, dividends, cashBalance, portfolioSnapshots, dailyPerformanceSnapshots } from "../../drizzle/schema";
import { eq, asc, and, desc, gte } from "drizzle-orm";
import { getDb } from "../db";
import { parseCSV } from "../lib/csvParser";
import {
  addTransactionAtomically,
  archiveAssetAtomically,
  deleteTransactionAtomically,
  importTransactionsAtomically,
} from "../services/portfolioMutationService";
import { TRPCError } from "@trpc/server";
import { buildClosedPerformanceHistory } from "../../shared/closedPerformanceHistory";

export const portfolioRouter = router({
  // ========== ASSETS ==========

  /** Lista todos os ativos do usuário */
  getAssets: protectedProcedure.query(async ({ ctx }) => {
    return getAssetsByUser(ctx.user.id);
  }),

  /** Cria um novo ativo */
  addAsset: protectedProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(32),
        name: z.string().min(1).max(128),
        assetClass: z.enum([
          "rv_nacional",
          "rv_eua",
          "fundos",
          "cripto",
          "renda_fixa",
          "uranio",
          "india",
          "caixa",
        ]),
        currency: z.enum(["BRL", "USD"]).default("BRL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifica se já existe
      const existing = await getAssetByTicker(input.ticker, ctx.user.id);
      if (existing) {
        return { id: existing.id, alreadyExists: true };
      }
      const id = await createAsset({
        userId: ctx.user.id,
        ticker: input.ticker,
        name: input.name,
        assetClass: input.assetClass,
        currency: input.currency,
      });
      return { id, alreadyExists: false };
    }),

  /** Arquiva um ativo sem apagar o ledger, quando a posição estiver zerada. */
  deleteAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return archiveAssetAtomically(input.assetId, ctx.user.id);
    }),

  /**
   * Atualiza manualmente o preço de um ativo cujo preço não é obtido automaticamente.
   * Restrito a classes que não possuem cotacao automática: fundos e renda_fixa.
   */
  updateManualPrice: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        newPrice: z.number().positive(),
        priceReferenceDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que o ativo pertence ao usuário e é de classe manual
      const asset = await getAssetById(input.assetId, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Ativo não encontrado" });
      const MANUAL_CLASSES = ["fundos", "renda_fixa"];
      if (!MANUAL_CLASSES.includes(asset.assetClass)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas Fundos e Renda Fixa suportam atualização manual de preço",
        });
      }
      const priceReferenceDate = input.priceReferenceDate ?? new Date();
      await updateAssetPrice(input.assetId, input.newPrice.toFixed(8), priceReferenceDate);
      return { success: true, assetId: input.assetId, newPrice: input.newPrice, priceReferenceDate };
    }),

  // ========== TRANSACTIONS ==========

  /** Lista todas as transações do usuário */
  getTransactions: protectedProcedure.query(async ({ ctx }) => {
    return getTransactionsByUser(ctx.user.id);
  }),

  /** Lista transações de um ativo específico */
  getAssetTransactions: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getTransactionsByAsset(input.assetId, ctx.user.id);
    }),

  /** Registra uma nova transação (compra ou venda) e recalcula preço médio */
  addTransaction: protectedProcedure
    .input(
      z.object({
        ticker: z.string().min(1),
        name: z.string().min(1),
        assetClass: z.enum([
          "rv_nacional",
          "rv_eua",
          "fundos",
          "cripto",
          "renda_fixa",
          "uranio",
          "india",
          "caixa",
        ]),
        currency: z.enum(["BRL", "USD"]).default("BRL"),
        type: z.enum(["buy", "sell"]),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        fees: z.number().min(0).default(0),
        transactionDate: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return addTransactionAtomically({
        userId: ctx.user.id,
        ticker: input.ticker,
        name: input.name,
        assetClass: input.assetClass,
        currency: input.currency,
        type: input.type,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        fees: input.fees,
        transactionDate: input.transactionDate,
        notes: input.notes,
      });
    }),

  /** Remove uma transação posterior ao marco conciliado e recalcula o ativo. */
  deleteTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number(), assetId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      return deleteTransactionAtomically(input.transactionId, ctx.user.id);
    }),

  // ========== COTAÇÕES ==========

  /** Busca cotações atualizadas para todos os ativos do usuário */
  refreshPrices: protectedProcedure.mutation(async ({ ctx }) => {
    const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos
    const now = new Date();

    const userAssets = await getAssetsByUser(ctx.user.id);
    if (userAssets.length === 0) return { updated: 0, cached: 0, usdBrl: 5.7, message: "Nenhum ativo na carteira." };

    // Filtrar apenas ativos com preço desatualizado ou sem preço
    const stale = userAssets.filter((a) => {
      if (!a.lastPriceUpdatedAt) return true;
      return (now.getTime() - new Date(a.lastPriceUpdatedAt).getTime()) > CACHE_TTL_MS;
    });

    if (stale.length === 0) {
      return {
        updated: 0,
        cached: userAssets.length,
        usdBrl: 5.7,
        message: "Cotações em cache, nenhuma atualização necessária.",
      };
    }

    // Buscar cotações apenas dos ativos desatualizados, em lotes de 10
    const BATCH_SIZE = 10;
    let updated = 0;
    const updates: { id: number; lastPrice: string }[] = [];

    for (let i = 0; i < stale.length; i += BATCH_SIZE) {
      const batch = stale.slice(i, i + BATCH_SIZE);
      const tickerList = batch.map((a) => ({
        ticker: a.ticker,
        assetClass: a.assetClass,
      }));

      try {
        const quotes = await fetchQuotes(tickerList);

        for (const asset of batch) {
          const quote = quotes.get(asset.ticker);
          if (quote) {
            updates.push({ id: asset.id, lastPrice: quote.price.toFixed(8) });
            updated++;
          }
        }
      } catch (e) {
        // silenciar erro individual — não quebrar o batch inteiro
        console.warn("[refreshPrices] Erro ao buscar lote:", e);
      }

      // Pausa entre lotes para não sobrecarregar o Yahoo Finance
      if (i + BATCH_SIZE < stale.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Atualizar preços e timestamps
    if (updates.length > 0) {
      const db = await getDb();
      if (db) {
        for (const update of updates) {
          await db.update(assets).set({ lastPrice: update.lastPrice, lastPriceUpdatedAt: now }).where(eq(assets.id, update.id));
        }
      }
    }

    const usdBrl = await fetchUsdBrl().catch(() => 5.7);

    return {
      updated,
      cached: userAssets.length - stale.length,
      usdBrl,
      message: `${updated} cotações atualizadas, ${userAssets.length - stale.length} em cache.`,
    };
  }),

  /** Busca o câmbio do consolidado: referência aprovada ou mercado. */
  getUsdBrl: protectedProcedure.query(async ({ ctx }) => {
    const marketRate = await fetchUsdBrl();
    return resolveValuationFxRateForUser(ctx.user.id, marketRate);
  }),

  /**
   * Série acumulada oficial para comparação com benchmarks. Só usa fechamentos
   * persistidos; não interpola meses nem inventa histórico anterior ao ledger.
   */
  getReturnHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { history: [], fromDate: null, lastClosedDate: null, snapshotCount: 0, isOfficial: true };
      const rows = await db.select({
        snapshotDate: dailyPerformanceSnapshots.snapshotDate,
        returnPct: dailyPerformanceSnapshots.returnPct,
      }).from(dailyPerformanceSnapshots).where(eq(dailyPerformanceSnapshots.userId, ctx.user.id))
        .orderBy(asc(dailyPerformanceSnapshots.snapshotDate));

      return { ...buildClosedPerformanceHistory(rows.map((row) => ({
        date: row.snapshotDate,
        returnPct: Number(row.returnPct),
      }))), isOfficial: true };
    } catch (err) {
      console.error("[getReturnHistory] Error:", err);
      return { history: [], fromDate: null, lastClosedDate: null, snapshotCount: 0, isOfficial: true };
    }
  }),

  getCurrencyBreakdown: protectedProcedure.query(async ({ ctx }) => {
    try {
      const assetsData = await getAssetsByUser(ctx.user.id);
      const BRL_CLASSES = ['rv_nacional', 'fundos', 'renda_fixa', 'caixa'];
      const USD_CLASSES = ['rv_eua', 'cripto', 'uranio', 'india'];

      const fxRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d');
      const fxData = await fxRes.json();
      const marketUsdBrl = fxData.chart.result[0].meta.regularMarketPrice ?? 5.7;
      const { rate: usdBrl } = await resolveValuationFxRateForUser(ctx.user.id, marketUsdBrl);

      let totalBrl = 0;
      let totalUsd = 0;

      for (const asset of assetsData) {
        const price = parseFloat(asset.lastPrice || asset.averageCost || "0");
        const qty = parseFloat(asset.totalQuantity || "0");
        const total = price * qty;
        if (BRL_CLASSES.includes(asset.assetClass)) totalBrl += total;
        else if (USD_CLASSES.includes(asset.assetClass)) totalUsd += total * usdBrl;
      }

      const grandTotal = totalBrl + totalUsd;
      return {
        brl: { value: totalBrl, percent: grandTotal > 0 ? (totalBrl / grandTotal) * 100 : 0, classes: ['RV Nacional', 'Fundos', 'Renda Fixa', 'Caixa'] },
        usd: { value: totalUsd, percent: grandTotal > 0 ? (totalUsd / grandTotal) * 100 : 0, classes: ['RV EUA', 'Criptomoedas', 'Urânio', 'Índia'] },
        usdBrl,
        total: grandTotal,
      };
    } catch (err) {
      console.error("[getCurrencyBreakdown] Error:", err);
      return { brl: { value: 0, percent: 0, classes: [] }, usd: { value: 0, percent: 0, classes: [] }, usdBrl: 5.7, total: 0 };
    }
  }),

  importCSV: protectedProcedure
    .input(z.object({ csvContent: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const parsed = parseCSV(input.csvContent);
      if (parsed.errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CSV inválido: ${parsed.errors.slice(0, 3).map((error) => `linha ${error.line}: ${error.message}`).join("; ")}`,
        });
      }
      if (parsed.total === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma transação encontrada. Verifique o formato do arquivo." });
      }
      const result = await importTransactionsAtomically({
        userId: ctx.user.id,
        format: parsed.format,
        transactions: parsed.transactions,
      });
      return { ...result, skipped: result.skippedDuplicate };
    }),

  // ========== EVENTS ==========

  /** Cria um novo evento no calendário */
  createEvent: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        ticker: z.string(),
        eventType: z.enum(["earnings", "dividendo", "split", "ipo", "desdobramento", "agrupamento", "evento_corporativo", "outro"]),
        description: z.string().optional(),
        eventDate: z.date(),
        exDate: z.date().optional(),
        expectedValue: z.string().optional(),
        valueUnit: z.string().default("BRL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const eventId = await createEvent({
        userId: ctx.user.id,
        assetId: input.assetId,
        ticker: input.ticker,
        eventType: input.eventType,
        description: input.description,
        eventDate: input.eventDate,
        exDate: input.exDate,
        expectedValue: input.expectedValue ? input.expectedValue : null,
        valueUnit: input.valueUnit,
      });
      return { id: eventId };
    }),

  /** Lista todos os eventos do usuário */
  getEvents: protectedProcedure
    .query(async ({ ctx }) => {
      return getEventsByUser(ctx.user.id);
    }),

  /** Lista eventos de um ativo específico */
  getEventsByAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getEventsByAsset(input.assetId, ctx.user.id);
    }),

  /** Lista eventos de um mês específico */
  getEventsByMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      return getEventsByMonth(ctx.user.id, input.year, input.month);
    }),

  /** Lista eventos próximos (próximos 30 dias) */
  getUpcomingEvents: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      return getUpcomingEvents(ctx.user.id, input.daysAhead);
    }),

  /** Atualiza um evento */
  updateEvent: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().optional(),
        eventDate: z.date().optional(),
        expectedValue: z.string().optional(),
        status: z.enum(["agendado", "realizado", "cancelado"]).optional(),
        actualResult: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await getEventById(input.id, ctx.user.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      
      await updateEvent(input.id, ctx.user.id, {
        description: input.description,
        eventDate: input.eventDate,
        expectedValue: input.expectedValue ? input.expectedValue : null,
        status: input.status,
        actualResult: input.actualResult,
      });
    }),

  /** Deleta um evento */
  deleteEvent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEventById(input.id, ctx.user.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      await deleteEvent(input.id, ctx.user.id);
    }),

  // ========== SEED ==========

  /** Importa a carteira completa do Dr. Thiago a partir dos dados estáticos */
  seedPortfolio: protectedProcedure
    .input(
      z.object({
        assets: z.array(
          z.object({
            ticker: z.string(),
            name: z.string(),
            assetClass: z.enum([
              "rv_nacional",
              "rv_eua",
              "fundos",
              "cripto",
              "renda_fixa",
              "uranio",
              "india",
              "caixa",
            ]),
            currency: z.enum(["BRL", "USD"]),
            quantity: z.number(),
            averageCost: z.number(),
            lastPrice: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let created = 0;
      let skipped = 0;

      for (const a of input.assets) {
        const existing = await getAssetByTicker(a.ticker, ctx.user.id);
        if (existing) {
          skipped++;
          continue;
        }

        const assetId = await createAsset({
          userId: ctx.user.id,
          ticker: a.ticker,
          name: a.name,
          assetClass: a.assetClass,
          currency: a.currency,
          totalQuantity: a.quantity.toFixed(8),
          averageCost: a.averageCost.toFixed(8),
          totalCost: (a.quantity * a.averageCost).toFixed(2),
          lastPrice: a.lastPrice.toFixed(8),
          lastPriceUpdatedAt: new Date(),
        });

        // Cria uma transação de compra inicial para registro
        await createTransaction({
          userId: ctx.user.id,
          assetId,
          type: "buy",
          quantity: a.quantity.toFixed(8),
          unitPrice: a.averageCost.toFixed(8),
          totalValue: (a.quantity * a.averageCost).toFixed(2),
          fees: "0",
          transactionDate: new Date("2025-01-01"),
          notes: "Importação inicial da carteira",
        });

        created++;
      }

      return { created, skipped };
    }),

  /** Captura manualmente o snapshot de hoje do patrimônio. */
  captureSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
    const [snapshot, dailyPerformance] = await Promise.all([
      captureSnapshotService(ctx.user.id),
      captureDailyPerformanceSnapshot(ctx.user.id),
    ]);
    return { ...snapshot, dailyPerformance };
  }),

  /** Histórico de snapshots diários do patrimônio (para o gráfico de evolução). */
  getSnapshotHistory: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(1095).default(365) }).optional())
    .query(async ({ ctx, input }) => {
      const history = await getSnapshotHistoryService(ctx.user.id, input?.days ?? 365);
      return { history };
    }),
  getPerformance: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [daily, monthly, cashRows, usdBrl] = await Promise.all([
      getLiveDailyPerformance(ctx.user.id),
      getMonthlyPerformance(ctx.user.id),
      db.select().from(cashBalance).where(eq(cashBalance.userId, ctx.user.id)).limit(1),
      fetchUsdBrl().catch(() => DEFAULT_USD_BRL_RATE),
    ]);
    const cash = Number(cashRows[0]?.balance ?? 0);
    const currentClassValues = Object.fromEntries(daily.byClass.map((item) => [item.classKey, item.valueBRL]));
    if (cash > 0) currentClassValues.caixa = cash;
    return {
      currentTotal: daily.totalValueBRL + cash,
      currentClassValues,
      usdBrl,
      daily: {
        total: { valueDiff: daily.totalBRL, percentDiff: daily.totalPct },
        externalContributionsBRL: daily.externalContributionsBRL,
        externalWithdrawalsBRL: daily.externalWithdrawalsBRL,
        netExternalFlowBRL: daily.netExternalFlowBRL,
        byClass: Object.fromEntries(daily.byClass.map((item) => [item.classKey, {
          valueDiff: item.changeBRL,
          percentDiff: item.changePct,
        }])),
        snapshotDate: daily.date,
      },
      monthly: {
        total: monthly?.total ?? null,
        byClass: monthly?.byClass ?? null,
        externalContributionsBRL: monthly?.externalContributionsBRL ?? 0,
        externalWithdrawalsBRL: monthly?.externalWithdrawalsBRL ?? 0,
        netExternalFlowBRL: monthly?.netExternalFlowBRL ?? 0,
        snapshotDate: monthly?.baseDate ?? null,
        chainedReturn: monthly?.total.percentDiff ?? null,
        snapshotCount: monthly?.snapshotCount ?? null,
        closedSnapshotCount: monthly?.closedSnapshotCount ?? 0,
        baseDate: monthly?.baseDate ?? null,
        lastClosedDate: monthly?.lastClosedDate ?? null,
        includesLiveDay: monthly?.includesLiveDay ?? false,
        isPartial: monthly?.isPartial ?? false,
        missingClosedDates: monthly?.missingClosedDates ?? [],
        hasClosedGaps: monthly?.hasClosedGaps ?? false,
      },
      hasSnapshots: !!monthly,
    };
  }),

  getMonthlyPerformanceDetails: protectedProcedure.query(async ({ ctx }) => {
    return getMonthlyPerformanceDetails(ctx.user.id);
  }),

  getAssetsDailyChange: protectedProcedure.query(async ({ ctx }) => {
    const daily = await getLiveDailyPerformance(ctx.user.id);
    return { byTicker: daily.byTicker, updatedAt: daily.updatedAt };
  }),

  getDailyPerformance: protectedProcedure.query(async ({ ctx }) => {
    return getLiveDailyPerformance(ctx.user.id);
  }),

});
