import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { cashBalance, cashMovements, cashStatements, receivedIncomes, cashDeposits, cashReconciliations } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { parseXPStatementXLSX, extractDepositsFromXPStatement, extractStatementBalances } from "../lib/xpStatementParser";

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

  /** Upload e parse de extrato XLSX (XP Investimentos) */
  uploadStatement: protectedProcedure
    .input(z.object({ fileBuffer: z.instanceof(Buffer), fileName: z.string(), statementMonth: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database connection failed" };

      try {
        // Parse extrato para extrair proventos e aportes
        const proventos = parseXPStatementXLSX(input.fileBuffer);
        const deposits = extractDepositsFromXPStatement(input.fileBuffer);
        const balances = extractStatementBalances(input.fileBuffer);

        if (!balances) return { success: false, message: "Could not extract balances from statement" };

        // Criar registro de statement
        const statementResult = await db
          .insert(cashStatements)
          .values({
            userId: ctx.user.id,
            fileName: input.fileName,
            uploadDate: new Date(),
            statementMonth: input.statementMonth,
            startBalance: balances.startBalance.toFixed(2),
            endBalance: balances.endBalance.toFixed(2),
            status: "pending",
          });

        // Recuperar ID do statement criado
        const statements = await db.select().from(cashStatements).where(eq(cashStatements.userId, ctx.user.id)).orderBy(desc(cashStatements.uploadDate)).limit(1);
        const statementId = statements[0]?.id;
        if (!statementId) return { success: false, message: "Failed to create statement record" };

        // Inserir proventos
        for (const provento of proventos) {
          await db.insert(receivedIncomes).values({
            userId: ctx.user.id,
            statementId,
            type: provento.type,
            description: provento.description,
            amount: provento.totalValue.toFixed(2),
            incomeDate: provento.paymentDate,
            category: provento.ticker,
          });
        }

        // Inserir aportes
        for (const deposit of deposits) {
          await db.insert(cashDeposits).values({
            userId: ctx.user.id,
            statementId,
            description: deposit.description,
            amount: deposit.amount.toFixed(2),
            depositDate: deposit.depositDate,
            category: deposit.category,
          });
        }

        // Criar reconciliação
        const balanceRows = await db.select().from(cashBalance).where(eq(cashBalance.userId, ctx.user.id)).limit(1);
        const platformBalance = Number(balanceRows[0]?.balance ?? 0);
        const discrepancy = Math.abs(platformBalance - balances.endBalance);
        const reconciliationStatus = discrepancy < 0.01 ? "reconciled" : "discrepancy_found";

        await db.insert(cashReconciliations).values({
          userId: ctx.user.id,
          statementId,
          platformBalance: platformBalance.toFixed(2),
          statementBalance: balances.endBalance.toFixed(2),
          discrepancy: discrepancy.toFixed(2),
          status: reconciliationStatus,
        });

        return {
          success: true,
          statementId,
          proventosCount: proventos.length,
          depositsCount: deposits.length,
          reconciliationStatus,
        };
      } catch (error) {
        console.error("Upload statement error:", error);
        return { success: false, message: String(error) };
      }
    }),

  /** Listar aportes extraídos do extrato */
  listDeposits: protectedProcedure
    .input(z.object({ statementId: z.number().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(cashDeposits.userId, ctx.user.id)];
      if (input?.statementId) {
        conditions.push(eq(cashDeposits.statementId, input.statementId));
      }
      return db
        .select()
        .from(cashDeposits)
        .where(and(...conditions))
        .orderBy(desc(cashDeposits.depositDate))
        .limit(input?.limit ?? 50);
    }),

  /** Listar proventos extraídos do extrato */
  listIncomes: protectedProcedure
    .input(z.object({ statementId: z.number().optional(), type: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(receivedIncomes.userId, ctx.user.id)];
      if (input?.statementId) {
        conditions.push(eq(receivedIncomes.statementId, input.statementId));
      }
      if (input?.type) {
        conditions.push(eq(receivedIncomes.type, input.type as any));
      }
      return db
        .select()
        .from(receivedIncomes)
        .where(and(...conditions))
        .orderBy(desc(receivedIncomes.incomeDate))
        .limit(input?.limit ?? 50);
    }),

  /** Listar statements enviados */
  listStatements: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(cashStatements)
        .where(eq(cashStatements.userId, ctx.user.id))
        .orderBy(desc(cashStatements.uploadDate))
        .limit(input?.limit ?? 20);
    }),
});
