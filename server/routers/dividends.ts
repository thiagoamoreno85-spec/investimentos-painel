import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dividends, assets, type Dividend } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const dividendsRouter = router({
  /**
   * Listar todos os dividendos do usuário (opcionalmente filtrado por ativo)
   */
  getDividends: protectedProcedure
    .input(
      z.object({
        assetId: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const userId = ctx.user.id;

      const rows = await db
        .select()
        .from(dividends)
        .where(eq(dividends.userId, userId))
        .orderBy(desc(dividends.exDate));

      if (input?.assetId) {
        return rows.filter((r: Dividend) => r.assetId === input.assetId);
      }

      return rows;
    }),

  /**
   * Resumo de dividendos por ativo com Yield on Cost e Current Yield
   */
  getDividendSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;

    const divRows = await db
      .select()
      .from(dividends)
      .where(eq(dividends.userId, userId))
      .orderBy(desc(dividends.exDate));

    const userAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId));

    type SummaryEntry = {
      assetId: number;
      ticker: string;
      name: string;
      assetClass: string;
      currency: string;
      totalDividends: number;
      dividendCount: number;
      lastDividendPerShare: number;
      lastExDate: Date | null;
      yieldOnCost: number;
      yieldOnCostAnnualized: number;
      avgCost: number;
      totalQuantity: number;
      totalCost: number;
      lastPrice: number;
      currentYield: number;
    };

    const summaryMap = new Map<number, SummaryEntry>();

    for (const div of divRows) {
      const asset = userAssets.find((a) => a.id === div.assetId);
      if (!asset) continue;

      if (!summaryMap.has(div.assetId)) {
        summaryMap.set(div.assetId, {
          assetId: div.assetId,
          ticker: asset.ticker,
          name: asset.name,
          assetClass: asset.assetClass,
          currency: asset.currency,
          totalDividends: 0,
          dividendCount: 0,
          lastDividendPerShare: 0,
          lastExDate: null,
          yieldOnCost: 0,
          yieldOnCostAnnualized: 0,
          avgCost: parseFloat(asset.averageCost),
          totalQuantity: parseFloat(asset.totalQuantity),
          totalCost: parseFloat(asset.totalCost),
          lastPrice: parseFloat(asset.lastPrice),
          currentYield: 0,
        });
      }

      const entry = summaryMap.get(div.assetId)!;
      entry.totalDividends += parseFloat(div.totalValue);
      entry.dividendCount += 1;

      if (!entry.lastExDate || div.exDate > entry.lastExDate) {
        entry.lastExDate = div.exDate;
        entry.lastDividendPerShare = parseFloat(div.valuePerShare);
      }
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const [, entry] of Array.from(summaryMap.entries())) {
      const totalCost = entry.totalCost;

      if (totalCost > 0) {
        entry.yieldOnCost = (entry.totalDividends / totalCost) * 100;

        const last12MonthsDivs = divRows
          .filter((d: Dividend) => d.assetId === entry.assetId && d.exDate >= oneYearAgo)
          .reduce((sum: number, d: Dividend) => sum + parseFloat(d.totalValue), 0);

        entry.yieldOnCostAnnualized = (last12MonthsDivs / totalCost) * 100;
      }

      if (entry.lastPrice > 0) {
        const annualDivPerShare = divRows
          .filter((d: Dividend) => d.assetId === entry.assetId && d.exDate >= oneYearAgo)
          .reduce((sum: number, d: Dividend) => sum + parseFloat(d.valuePerShare), 0);

        entry.currentYield = (annualDivPerShare / entry.lastPrice) * 100;
      }
    }

    return Array.from(summaryMap.values()).sort(
      (a, b) => b.totalDividends - a.totalDividends
    );
  }),

  /**
   * Registrar novo dividendo/provento
   */
  addDividend: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        type: z.enum(["dividendo", "jcp", "rendimento", "amortizacao", "bonificacao", "outro"]),
        valuePerShare: z.number().positive(),
        quantity: z.number().positive(),
        currency: z.enum(["BRL", "USD"]).default("BRL"),
        exDate: z.date(),
        paymentDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      const assetRows = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, input.assetId), eq(assets.userId, userId)))
        .limit(1);

      if (assetRows.length === 0) throw new Error("Ativo não encontrado");
      const asset = assetRows[0];

      const totalValue = input.valuePerShare * input.quantity;

      const result = await db.insert(dividends).values({
        userId,
        assetId: input.assetId,
        type: input.type,
        valuePerShare: input.valuePerShare.toString(),
        quantity: input.quantity.toString(),
        totalValue: totalValue.toFixed(2),
        currency: input.currency,
        exDate: input.exDate,
        paymentDate: input.paymentDate,
        notes: input.notes,
      });

      return {
        id: (result[0] as any).insertId,
        totalValue,
        ticker: asset.ticker,
      };
    }),

  /**
   * Remover dividendo
   */
  deleteDividend: protectedProcedure
    .input(z.object({ dividendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      await db
        .delete(dividends)
        .where(and(eq(dividends.id, input.dividendId), eq(dividends.userId, userId)));

      return { success: true };
    }),

  /**
   * Totais de dividendos por mês (para gráfico)
   */
  getDividendsByMonth: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;

    const rows = await db
      .select()
      .from(dividends)
      .where(eq(dividends.userId, userId))
      .orderBy(dividends.exDate);

    const monthMap = new Map<string, number>();

    for (const div of rows) {
      const date = new Date(div.exDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + parseFloat(div.totalValue));
    }

    return Array.from(monthMap.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-24);
  }),

  /**
   * Total geral de dividendos recebidos
   */
  getTotalDividends: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, count: 0 };
    const userId = ctx.user.id;

    const rows = await db
      .select()
      .from(dividends)
      .where(eq(dividends.userId, userId));

    const total = rows.reduce((sum: number, d: Dividend) => sum + parseFloat(d.totalValue), 0);
    return { total, count: rows.length };
  }),
});
