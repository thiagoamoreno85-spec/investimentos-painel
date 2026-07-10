import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  patrimonialAssets,
  patrimonialLiabilities,
  patrimonialLiabilityPayments,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Patrimônio — Controle de ativos imobilizados, créditos e passivos
 */
export const patrimonialRouter = router({
  // ===== ATIVOS PATRIMONIAIS =====

  listAssets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const assets = await db
      .select()
      .from(patrimonialAssets)
      .where(
        and(
          eq(patrimonialAssets.userId, ctx.user.id),
          eq(patrimonialAssets.isActive, 1)
        )
      )
      .orderBy(patrimonialAssets.createdAt);

    return assets.map((a) => ({
      ...a,
      currentValue: parseFloat(a.currentValue.toString()),
      acquisitionValue: a.acquisitionValue
        ? parseFloat(a.acquisitionValue.toString())
        : null,
    }));
  }),

  createAsset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        assetType: z.enum([
          "imovel",
          "veiculo",
          "credito",
          "participacao",
          "equipamento",
          "outro",
        ]),
        description: z.string().optional(),
        currentValue: z.number().positive(),
        acquisitionValue: z.number().optional(),
        acquisitionDate: z.date().optional(),
        debtorName: z.string().optional(),
        dueDate: z.date().optional(),
        interestRate: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.insert(patrimonialAssets).values({
        userId: ctx.user.id,
        name: input.name,
        assetType: input.assetType,
        description: input.description || null,
        currentValue: input.currentValue.toString(),
        acquisitionValue: input.acquisitionValue ? input.acquisitionValue.toString() : null,
        acquisitionDate: input.acquisitionDate || null,
        debtorName: input.debtorName || null,
        dueDate: input.dueDate || null,
        interestRate: input.interestRate ? input.interestRate.toString() : null,
        notes: input.notes || null,
        isActive: 1,
      });

      // Buscar o ativo criado para retornar seu ID
      const created = await db
        .select()
        .from(patrimonialAssets)
        .where(
          and(
            eq(patrimonialAssets.userId, ctx.user.id),
            eq(patrimonialAssets.name, input.name)
          )
        )
        .orderBy(desc(patrimonialAssets.createdAt))
        .limit(1)
        .then((res: any[]) => res[0]);

      return { id: created?.id || 0 };
    }),

  updateAsset: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        currentValue: z.number().positive().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db
        .update(patrimonialAssets)
        .set({
          currentValue: input.currentValue ? input.currentValue.toString() : undefined,
          description: input.description || undefined,
          notes: input.notes || undefined,
        })
        .where(
          and(
            eq(patrimonialAssets.id, input.id),
            eq(patrimonialAssets.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db
        .update(patrimonialAssets)
        .set({ isActive: 0 })
        .where(
          and(
            eq(patrimonialAssets.id, input.id),
            eq(patrimonialAssets.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // ===== PASSIVOS PATRIMONIAIS =====

  listLiabilities: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const liabilities = await db
      .select()
      .from(patrimonialLiabilities)
      .where(
        and(
          eq(patrimonialLiabilities.userId, ctx.user.id),
          eq(patrimonialLiabilities.isActive, 1)
        )
      )
      .orderBy(patrimonialLiabilities.createdAt);

    return liabilities.map((l) => ({
      ...l,
      originalAmount: parseFloat(l.originalAmount.toString()),
      remainingBalance: parseFloat(l.remainingBalance.toString()),
      installmentValue: l.installmentValue
        ? parseFloat(l.installmentValue.toString())
        : null,
      interestRate: l.interestRate
        ? parseFloat(l.interestRate.toString())
        : null,
    }));
  }),

  createLiability: protectedProcedure
    .input(
      z.object({
        assetId: z.number().optional(),
        name: z.string().min(1),
        creditor: z.string().optional(),
        originalAmount: z.number().positive(),
        installmentValue: z.number().optional(),
        totalInstallments: z.number().int().positive().optional(),
        interestRate: z.number().optional(),
        startDate: z.date(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.insert(patrimonialLiabilities).values({
        userId: ctx.user.id,
        assetId: input.assetId || null,
        name: input.name,
        creditor: input.creditor || null,
        originalAmount: input.originalAmount.toString(),
        remainingBalance: input.originalAmount.toString(),
        installmentValue: input.installmentValue ? input.installmentValue.toString() : null,
        totalInstallments: input.totalInstallments || null,
        interestRate: input.interestRate ? input.interestRate.toString() : null,
        startDate: input.startDate,
        endDate: input.endDate || null,
        notes: input.notes || null,
        paidInstallments: 0,
        isActive: 1,
      });

      // Buscar o passivo criado para retornar seu ID
      const created = await db
        .select()
        .from(patrimonialLiabilities)
        .where(
          and(
            eq(patrimonialLiabilities.userId, ctx.user.id),
            eq(patrimonialLiabilities.name, input.name)
          )
        )
        .orderBy(desc(patrimonialLiabilities.createdAt))
        .limit(1)
        .then((res: any[]) => res[0]);

      return { id: created?.id || 0 };
    }),

  registerPayment: protectedProcedure
    .input(
      z.object({
        liabilityId: z.number(),
        amount: z.number().positive(),
        paymentDate: z.date(),
        installmentNumber: z.number().int().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      // Registrar pagamento
      await db.insert(patrimonialLiabilityPayments).values({
        userId: ctx.user.id,
        liabilityId: input.liabilityId,
        paymentDate: input.paymentDate,
        amount: input.amount.toString(),
        installmentNumber: input.installmentNumber || undefined,
        notes: input.notes || null,
      });

      // Atualizar saldo do passivo
      const liability = await db
        .select()
        .from(patrimonialLiabilities)
        .where(eq(patrimonialLiabilities.id, input.liabilityId))
        .then((res: any[]) => res[0]);

      if (!liability) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Passivo não encontrado",
        });
      }

      const newBalance = Math.max(
        0,
        parseFloat(liability.remainingBalance.toString()) - input.amount
      );

      await db
        .update(patrimonialLiabilities)
        .set({
          remainingBalance: newBalance.toString(),
          paidInstallments: ((liability.paidInstallments as number) || 0) + 1,
          isActive: newBalance > 0 ? 1 : 0,
        })
        .where(eq(patrimonialLiabilities.id, input.liabilityId));

      return { success: true, newBalance: parseFloat(newBalance.toString()) };
    }),

  listPayments: protectedProcedure
    .input(z.object({ liabilityId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const payments = await db
        .select()
        .from(patrimonialLiabilityPayments)
        .where(
          and(
            eq(patrimonialLiabilityPayments.userId, ctx.user.id),
            eq(patrimonialLiabilityPayments.liabilityId, input.liabilityId)
          )
        )
        .orderBy(desc(patrimonialLiabilityPayments.paymentDate));

      return payments.map((p) => ({
        ...p,
        amount: parseFloat(p.amount.toString()),
      }));
    }),

  deleteLiability: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db
        .update(patrimonialLiabilities)
        .set({ isActive: 0 })
        .where(
          and(
            eq(patrimonialLiabilities.id, input.id),
            eq(patrimonialLiabilities.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ===== RESUMO CONSOLIDADO =====

  /**
   * Retorna Net Worth consolidado: Ativos Financeiros (portfolio) + Patrimônio Líquido (imobilizados - passivos)
   * Requer acesso a portfolio.getPerformance para obter valor total de ativos financeiros
   */
  getConsolidatedNetWorth: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Obter resumo patrimonial (ativos imobilizados - passivos)
    const patrimonialAssetRows = await db
      .select()
      .from(patrimonialAssets)
      .where(
        and(
          eq(patrimonialAssets.userId, ctx.user.id),
          eq(patrimonialAssets.isActive, 1)
        )
      );

    const patrimonialLiabilityRows = await db
      .select()
      .from(patrimonialLiabilities)
      .where(
        and(
          eq(patrimonialLiabilities.userId, ctx.user.id),
          eq(patrimonialLiabilities.isActive, 1)
        )
      );

    const totalPatrimonialAssets = patrimonialAssetRows.reduce(
      (sum: number, a: any) => sum + parseFloat(a.currentValue.toString()),
      0
    );

    const totalPatrimonialLiabilities = patrimonialLiabilityRows.reduce(
      (sum: number, l: any) => sum + parseFloat(l.remainingBalance.toString()),
      0
    );

    const patrimonialNetWorth = totalPatrimonialAssets - totalPatrimonialLiabilities;

    return {
      patrimonialAssets: totalPatrimonialAssets,
      patrimonialLiabilities: totalPatrimonialLiabilities,
      patrimonialNetWorth,
      description: "Patrimônio Líquido = Ativos Imobilizados - Passivos",
    };
  }),

  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const assets = await db
      .select()
      .from(patrimonialAssets)
      .where(
        and(
          eq(patrimonialAssets.userId, ctx.user.id),
          eq(patrimonialAssets.isActive, 1)
        )
      );

    const liabilities = await db
      .select()
      .from(patrimonialLiabilities)
      .where(
        and(
          eq(patrimonialLiabilities.userId, ctx.user.id),
          eq(patrimonialLiabilities.isActive, 1)
        )
      );

    const totalAssets = assets.reduce(
      (sum: number, a: any) => sum + parseFloat(a.currentValue.toString()),
      0
    );

    const totalLiabilities = liabilities.reduce(
      (sum: number, l: any) => sum + parseFloat(l.remainingBalance.toString()),
      0
    );

    const netWorth = totalAssets - totalLiabilities;

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      assetCount: assets.length,
      liabilityCount: liabilities.length,
      assetsByType: assets.reduce(
        (acc: Record<string, number>, a: any) => {
          acc[a.assetType] = (acc[a.assetType] || 0) + parseFloat(a.currentValue.toString());
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }),
});
