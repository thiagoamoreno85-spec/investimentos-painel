import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getNewsItemsByUser,
  markNewsItemRead,
  markAllNewsRead,
  countUnreadNews,
  getAssetsByUser,
} from "../db";
import { runNewsRefresh } from "../services/newsRefreshService";
import { fetchUsdBrl } from "../quotes";
import { prioritizeNewsForPortfolio } from "../services/newsPrioritization";
import { hasIrrecoverableNewsEncoding, sanitizeNewsText } from "../services/newsText";

function parseAffectedTickers(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((ticker): ticker is string => typeof ticker === "string") : [];
  } catch {
    return [];
  }
}

export const newsRouter = router({
  /**
   * Listar notícias do usuário com filtros opcionais
   */
  list: protectedProcedure
    .input(
      z
        .object({
          category: z
            .enum(["brasil", "global", "cripto", "tech", "politica", "macro", "all"])
            .default("all"),
          impactLevel: z.enum(["alto", "medio", "baixo", "all"]).default("all"),
          onlyUnread: z.boolean().default(false),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit ?? 50;
      const rows = await getNewsItemsByUser(userId, limit);
      const assets = await getAssetsByUser(userId);
      const hasUsdAssets = assets.some((asset) => asset.currency === "USD");
      const usdBrl = hasUsdAssets ? await fetchUsdBrl() : 1;

      const displayableRows = rows.filter((row) => ![
        row.title,
        row.summary,
        row.impactAnalysis,
        row.source,
      ].some(hasIrrecoverableNewsEncoding));

      let filtered = prioritizeNewsForPortfolio(
        displayableRows.map((row) => ({
          ...row,
          title: sanitizeNewsText(row.title),
          summary: sanitizeNewsText(row.summary),
          impactAnalysis: sanitizeNewsText(row.impactAnalysis),
          source: sanitizeNewsText(row.source),
          affectedTickers: parseAffectedTickers(row.affectedTickers),
        })),
        assets,
        usdBrl
      );

      if (input?.category && input.category !== "all") {
        filtered = filtered.filter((r) => r.category === input.category);
      }
      if (input?.impactLevel && input.impactLevel !== "all") {
        filtered = filtered.filter((r) => r.impactLevel === input.impactLevel);
      }
      if (input?.onlyUnread) {
        filtered = filtered.filter((r) => r.isRead === 0);
      }

      return filtered;
    }),

  /**
   * Contar notícias não lidas
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return countUnreadNews(ctx.user.id);
  }),

  /**
   * Buscar e analisar novas notícias via LLM
   */
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    return runNewsRefresh(ctx.user.id);
  }),

  /**
   * Marcar uma notícia como lida
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNewsItemRead(input.id, ctx.user.id);
      return { ok: true };
    }),

  /**
   * Marcar todas as notícias como lidas
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNewsRead(ctx.user.id);
    return { ok: true };
  }),
});
