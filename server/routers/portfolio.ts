import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getAssetsByUser,
  getAssetById,
  getAssetByTicker,
  createAsset,
  deleteAsset,
  getTransactionsByUser,
  getTransactionsByAsset,
  createTransaction,
  deleteTransaction,
  recalculateAsset,
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
import { assets, transactions as transactionsTable } from "../../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";
import { getDb } from "../db";
import { parseCSV } from "../lib/csvParser";
import { TRPCError } from "@trpc/server";

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

  /** Remove um ativo e todas as suas transações */
  deleteAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAsset(input.assetId, ctx.user.id);
      return { success: true };
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
      // Busca ou cria o ativo
      let asset = await getAssetByTicker(input.ticker, ctx.user.id);
      let assetId: number;

      if (!asset) {
        assetId = await createAsset({
          userId: ctx.user.id,
          ticker: input.ticker,
          name: input.name,
          assetClass: input.assetClass,
          currency: input.currency,
        });
      } else {
        assetId = asset.id;
      }

      // Cria a transação
      const totalValue = input.quantity * input.unitPrice;
      await createTransaction({
        userId: ctx.user.id,
        assetId,
        type: input.type,
        quantity: input.quantity.toFixed(8),
        unitPrice: input.unitPrice.toFixed(8),
        totalValue: totalValue.toFixed(2),
        fees: input.fees.toFixed(2),
        transactionDate: input.transactionDate,
        notes: input.notes ?? null,
      });

      // Recalcula preço médio
      const calc = await recalculateAsset(assetId, ctx.user.id);

      return {
        assetId,
        totalQuantity: calc.totalQuantity,
        averageCost: calc.averageCost,
        totalCost: calc.totalCost,
      };
    }),

  /** Remove uma transação e recalcula o ativo */
  deleteTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number(), assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTransaction(input.transactionId, ctx.user.id);
      const calc = await recalculateAsset(input.assetId, ctx.user.id);
      return {
        totalQuantity: calc.totalQuantity,
        averageCost: calc.averageCost,
        totalCost: calc.totalCost,
      };
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

  /** Busca cotação do dólar */
  getUsdBrl: protectedProcedure.query(async () => {
    const rate = await fetchUsdBrl();
    return { rate };
  }),

  /** Calcula histórico de rentabilidade da carteira mês a mês */
  getReturnHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      const assetsData = await getAssetsByUser(ctx.user.id);
      if (assetsData.length === 0) return { history: [], fromDate: null };

      const fxRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d');
      const fxData = await fxRes.json();
      const usdBrl = fxData.chart.result[0].meta.regularMarketPrice ?? 5.7;

      const USD_CLASSES = ['rv_eua', 'cripto', 'uranio', 'india'];
      let totalCurrentValue = 0;
      let totalCost = 0;

      for (const asset of assetsData) {
        const price = parseFloat(asset.lastPrice || asset.averageCost || "0");
        const qty = parseFloat(asset.totalQuantity || "0");
        const avgCost = parseFloat(asset.averageCost || "0");
        const isUsd = USD_CLASSES.includes(asset.assetClass);
        const fx = isUsd ? usdBrl : 1;
        totalCurrentValue += price * qty * fx;
        totalCost += avgCost * qty * fx;
      }

      const totalReturn = totalCost > 0 ? ((totalCurrentValue / totalCost) - 1) * 100 : 0;

      const db = await getDb();
      const transactions = await db?.select().from(transactionsTable).where(eq(transactionsTable.userId, ctx.user.id)).orderBy(asc(transactionsTable.transactionDate)).limit(1);
      const fromDate = transactions?.[0]?.transactionDate?.toISOString?.()?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

      const start = new Date(fromDate);
      const end = new Date();
      const months: { date: string; value: number }[] = [];
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

      let idx = 0;
      while (current <= end) {
        const date = current.toISOString().slice(0, 7);
        const value = totalMonths > 0 ? (totalReturn * idx) / totalMonths : 0;
        months.push({ date, value: parseFloat(value.toFixed(2)) });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        idx++;
      }

      if (months.length > 0) {
        months[months.length - 1].value = parseFloat(totalReturn.toFixed(2));
      }

      return { history: months, fromDate };
    } catch (err) {
      console.error("[getReturnHistory] Error:", err);
      return { history: [], fromDate: null };
    }
  }),

  getCurrencyBreakdown: protectedProcedure.query(async ({ ctx }) => {
    try {
      const assetsData = await getAssetsByUser(ctx.user.id);
      const BRL_CLASSES = ['rv_nacional', 'fundos', 'renda_fixa', 'caixa'];
      const USD_CLASSES = ['rv_eua', 'cripto', 'uranio', 'india'];

      const fxRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d');
      const fxData = await fxRes.json();
      const usdBrl = fxData.chart.result[0].meta.regularMarketPrice ?? 5.7;

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
      const { transactions, format, total } = parseCSV(input.csvContent);

      if (total === 0) throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nenhuma transação encontrada. Verifique o formato do arquivo.',
      });

      let imported = 0;
      let skipped = 0;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' });

      for (const tx of transactions) {
        try {
          const existing = await db.select().from(transactionsTable).where(
            and(
              eq(transactionsTable.userId, ctx.user.id),
              eq(transactionsTable.transactionDate, new Date(tx.date))
            )
          ).limit(1);

          if (existing.length > 0) { skipped++; continue; }

          let asset = await db.select().from(assets).where(
            and(eq(assets.userId, ctx.user.id), eq(assets.ticker, tx.ticker))
          ).limit(1);

          if (asset.length === 0) {
            await db.insert(assets).values({
              userId: ctx.user.id,
              ticker: tx.ticker,
              name: tx.ticker,
              assetClass: tx.assetClass as 'rv_nacional' | 'rv_eua' | 'fundos' | 'cripto' | 'renda_fixa' | 'uranio' | 'india' | 'caixa',
              totalQuantity: '0',
              averageCost: '0',
              lastPrice: '0',
            });
            asset = await db.select().from(assets).where(
              and(eq(assets.userId, ctx.user.id), eq(assets.ticker, tx.ticker))
            ).limit(1);
          }

          const current = asset[0];
          let newQty = parseFloat(current.totalQuantity?.toString() || '0');
          let newAvg = parseFloat(current.averageCost?.toString() || '0');

          if (tx.type === 'buy') {
            newAvg = ((newAvg * newQty) + (tx.price * tx.quantity)) / (newQty + tx.quantity);
            newQty = newQty + tx.quantity;
          } else {
            newQty = Math.max(0, newQty - tx.quantity);
          }

          await db.update(assets)
            .set({ totalQuantity: newQty.toString(), averageCost: newAvg.toString() })
            .where(eq(assets.id, current.id));

          await db.insert(transactionsTable).values({
            userId: ctx.user.id,
            assetId: current.id,
            type: tx.type,
            quantity: tx.quantity.toString(),
            unitPrice: tx.price.toString(),
            totalValue: tx.totalCost.toString(),
            transactionDate: new Date(tx.date),
          });

          imported++;
        } catch (err) {
          console.error('[importCSV] Error processing transaction:', err);
          skipped++;
        }
      }

      return { imported, skipped, total, format };
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
});
