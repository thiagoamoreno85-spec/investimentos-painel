import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { cashBalance, cashMovements, cashStatements, receivedIncomes, cashReconciliations } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { parseCashTransactions, parseXPStatementXLSX, extractStatementBalances } from "../lib/xpStatementParser";

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

  /** Upload e parse de extrato bancário */
  uploadStatement: protectedProcedure
    .input(
      z.object({
        file: z.instanceof(Buffer),
        fileName: z.string(),
        statementMonth: z.string(), // YYYY-MM
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const transactions = parseCashTransactions(input.file);
        const proventos = parseXPStatementXLSX(input.file);
        const balances = extractStatementBalances(input.file);

        const totalAportes = transactions
          .filter((t) => t.type === "aporte")
          .reduce((sum, t) => sum + t.amount, 0);

        const result = await db
          .insert(cashStatements)
          .values({
            userId: ctx.user.id,
            fileName: input.fileName,
            uploadDate: new Date(),
            statementMonth: input.statementMonth,
            startBalance: balances.startBalance,
            endBalance: balances.endBalance,
            status: "processed",
          });

        if (!result) throw new Error("Failed to create statement");
        const statementId = result.insertId;

        if (proventos.length > 0) {
          await db.insert(receivedIncomes).values(
            proventos.map((p) => ({
              userId: ctx.user.id,
              statementId: statementId,
              type: p.type as "dividendo" | "jcp" | "rendimento" | "outro",
              description: p.description,
              amount: p.totalValue,
              incomeDate: p.paymentDate,
              category: p.ticker,
            }))
          );
        }

        await db.insert(cashReconciliations).values({
          userId: ctx.user.id,
          statementId: statementId,
          platformBalance: 0,
          statementBalance: balances.endBalance,
          discrepancy: 0,
          status: "pending",
        });

        return {
          success: true,
          statement: { id: statementId, userId: ctx.user.id, fileName: input.fileName, statementMonth: input.statementMonth, startBalance: balances.startBalance, endBalance: balances.endBalance, status: "processed" as const },
          summary: {
            totalAportes,
            transactionCount: transactions.length,
            proventoCount: proventos.length,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await db
          .insert(cashStatements)
          .values({
            userId: ctx.user.id,
            fileName: input.fileName,
            uploadDate: new Date(),
            statementMonth: input.statementMonth,
            startBalance: 0,
            endBalance: 0,
            status: "error",
            errorMessage,
          });

        return { success: false, error: errorMessage };
      }
    }),

  /** Listar proventos recebidos */
  listIncomes: protectedProcedure
    .input(
      z.object({
        month: z.string().optional(),
        type: z.enum(["dividendo", "jcp", "aluguel", "rendimento", "outro"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const filters = [eq(receivedIncomes.userId, ctx.user.id)];
      if (input.type) {
        filters.push(eq(receivedIncomes.type, input.type));
      }

      return db
        .select()
        .from(receivedIncomes)
        .where(and(...filters))
        .orderBy(receivedIncomes.incomeDate);
    }),

  /** Listar statements */
  listStatements: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(cashStatements)
      .where(eq(cashStatements.userId, ctx.user.id))
      .orderBy(desc(cashStatements.uploadDate));
  }),
});
