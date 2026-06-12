import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getNewsItemsByUser,
  markNewsItemRead,
  markAllNewsRead,
  countUnreadNews,
} from "../db";
import { runNewsRefresh } from "../services/newsRefreshService";

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

      let filtered = rows;

      if (input?.category && input.category !== "all") {
        filtered = filtered.filter((r) => r.category === input.category);
      }
      if (input?.impactLevel && input.impactLevel !== "all") {
        filtered = filtered.filter((r) => r.impactLevel === input.impactLevel);
      }
      if (input?.onlyUnread) {
        filtered = filtered.filter((r) => r.isRead === 0);
      }

      return filtered.map((r) => ({
        ...r,
        affectedTickers: r.affectedTickers ? JSON.parse(r.affectedTickers) : [],
      }));
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
