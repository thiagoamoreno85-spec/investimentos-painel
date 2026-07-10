import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { cashBalance, cashMovements } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";

export const cashRouter = router({
  /** Buscar saldo atual do caixa */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { balance: 0, updatedAt: null };
    const rows = await db
      .select()
      .from(cashBalance)
      .where(eq(cashBalance.userId, ctx.user.id))
      .limit(1);
    return {
      balance: Number(rows[0]?.balance ?? 0),
      updatedAt: rows[0]?.updatedAt ?? null,
    };
  }),

  /** Definir saldo manualmente (upsert) */
  setBalance: protectedProcedure
    .input(z.object({ balance: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, balance: 0 };
      const existing = await db
        .select()
        .from(cashBalance)
        .where(eq(cashBalance.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(cashBalance)
          .set({ balance: input.balance.toFixed(2), updatedAt: new Date() })
          .where(eq(cashBalance.userId, ctx.user.id));
      } else {
        await db.insert(cashBalance).values({
          userId: ctx.user.id,
          balance: input.balance.toFixed(2),
        });
      }
      return { success: true, balance: input.balance };
    }),

  /** Registrar movimentação (atualiza saldo automaticamente) */
  addMovement: protectedProcedure
    .input(
      z.object({
        type: z.enum(["entrada", "saida"]),
        category: z.enum([
          "dividendo_recebido",
          "vencimento_rf",
          "aporte_externo",
          "compra_ativo",
          "resgate",
          "taxa",
          "outro",
        ]),
        amount: z.number().positive(),
        description: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, newBalance: 0 };

      // Registrar movimentação
      await db.insert(cashMovements).values({
        userId: ctx.user.id,
        type: input.type,
        category: input.category,
        amount: input.amount.toFixed(2),
        description: input.description ?? null,
        date: input.date ? new Date(input.date) : new Date(),
      });

      // Atualizar saldo automaticamente
      const current = await db
        .select()
        .from(cashBalance)
        .where(eq(cashBalance.userId, ctx.user.id))
        .limit(1);
      const currentBalance = Number(current[0]?.balance ?? 0);
      const newBalance =
        input.type === "entrada"
          ? currentBalance + input.amount
          : Math.max(0, currentBalance - input.amount);

      if (current.length > 0) {
        await db
          .update(cashBalance)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(cashBalance.userId, ctx.user.id));
      } else {
        await db.insert(cashBalance).values({
          userId: ctx.user.id,
          balance: newBalance.toFixed(2),
        });
      }

      return { success: true, newBalance };
    }),

  /** Listar movimentações recentes */
  listMovements: protectedProcedure
    .input(z.object({ limit: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.userId, ctx.user.id))
        .orderBy(desc(cashMovements.date))
        .limit(input?.limit ?? 30);
    }),

  /** Deletar movimentação e reverter saldo */
  deleteMovement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const mov = await db
        .select()
        .from(cashMovements)
        .where(
          and(
            eq(cashMovements.id, input.id),
            eq(cashMovements.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!mov.length) return { success: false };

      // Reverter o efeito no saldo
      const current = await db
        .select()
        .from(cashBalance)
        .where(eq(cashBalance.userId, ctx.user.id))
        .limit(1);
      const currentBalance = Number(current[0]?.balance ?? 0);
      const revertedBalance =
        mov[0].type === "entrada"
          ? Math.max(0, currentBalance - Number(mov[0].amount))
          : currentBalance + Number(mov[0].amount);

      await db
        .update(cashBalance)
        .set({ balance: revertedBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(cashBalance.userId, ctx.user.id));

      await db.delete(cashMovements).where(eq(cashMovements.id, input.id));

      return { success: true, newBalance: revertedBalance };
    }),
});
