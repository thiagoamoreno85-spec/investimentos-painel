import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alerts, assets, type Alert } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const alertsRouter = router({
  /**
   * Listar alertas do usuário
   */
  getAlerts: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "triggered", "dismissed", "all"]).default("all"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const userId = ctx.user.id;

      const rows = await db
        .select()
        .from(alerts)
        .where(eq(alerts.userId, userId))
        .orderBy(desc(alerts.createdAt));

      const status = input?.status ?? "all";
      if (status === "all") return rows;
      return rows.filter((r: Alert) => r.status === status);
    }),

  /**
   * Contar alertas ativos e disparados
   */
  getAlertCounts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { active: 0, triggered: 0 };
    const userId = ctx.user.id;

    const rows = await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId));

    const active = rows.filter((r: Alert) => r.status === "active").length;
    const triggered = rows.filter((r: Alert) => r.status === "triggered").length;

    return { active, triggered };
  }),

  /**
   * Criar novo alerta
   */
  createAlert: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        type: z.enum([
          "price_drop",
          "price_rise",
          "below_avg_cost",
          "above_target",
          "below_target",
          "buy_opportunity",
        ]),
        threshold: z.number().min(0),
        targetPrice: z.number().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      // Verificar que o ativo pertence ao usuário
      const assetRows = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, input.assetId), eq(assets.userId, userId)))
        .limit(1);

      if (assetRows.length === 0) throw new Error("Ativo não encontrado");

      const result = await db.insert(alerts).values({
        userId,
        assetId: input.assetId,
        type: input.type,
        threshold: input.threshold.toString(),
        targetPrice: input.targetPrice?.toString(),
        notes: input.notes,
        status: "active",
      });

      return { id: (result[0] as any).insertId };
    }),

  /**
   * Dispensar alerta (marcar como dismissed)
   */
  dismissAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      await db
        .update(alerts)
        .set({ status: "dismissed" })
        .where(and(eq(alerts.id, input.alertId), eq(alerts.userId, userId)));

      return { success: true };
    }),

  /**
   * Reativar alerta
   */
  reactivateAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      await db
        .update(alerts)
        .set({ status: "active", triggeredMessage: null, triggeredAt: null })
        .where(and(eq(alerts.id, input.alertId), eq(alerts.userId, userId)));

      return { success: true };
    }),

  /**
   * Deletar alerta
   */
  deleteAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;

      await db
        .delete(alerts)
        .where(and(eq(alerts.id, input.alertId), eq(alerts.userId, userId)));

      return { success: true };
    }),

  /**
   * Verificar e disparar alertas ativos com base nos preços atuais
   * Retorna lista de alertas disparados nesta verificação
   */
  checkAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { triggered: [] };
    const userId = ctx.user.id;

    // Buscar alertas ativos
    const activeAlerts = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.userId, userId), eq(alerts.status, "active")));

    if (activeAlerts.length === 0) return { triggered: [] };

    // Buscar ativos do usuário
    const userAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId));

    const triggered: {
      alertId: number;
      ticker: string;
      message: string;
      type: string;
    }[] = [];

    for (const alert of activeAlerts) {
      const asset = userAssets.find((a) => a.id === alert.assetId);
      if (!asset) continue;

      const lastPrice = parseFloat(asset.lastPrice);
      const avgCost = parseFloat(asset.averageCost);
      const threshold = parseFloat(alert.threshold);
      const targetPrice = alert.targetPrice ? parseFloat(alert.targetPrice) : null;

      if (lastPrice <= 0) continue;

      let shouldTrigger = false;
      let message = "";

      switch (alert.type) {
        case "price_drop": {
          // Queda percentual em relação ao preço de referência (custo médio)
          if (avgCost > 0) {
            const dropPct = ((avgCost - lastPrice) / avgCost) * 100;
            if (dropPct >= threshold) {
              shouldTrigger = true;
              message = `${asset.ticker} caiu ${dropPct.toFixed(1)}% abaixo do custo médio (limite: ${threshold}%)`;
            }
          }
          break;
        }
        case "price_rise": {
          if (avgCost > 0) {
            const risePct = ((lastPrice - avgCost) / avgCost) * 100;
            if (risePct >= threshold) {
              shouldTrigger = true;
              message = `${asset.ticker} subiu ${risePct.toFixed(1)}% acima do custo médio (limite: ${threshold}%)`;
            }
          }
          break;
        }
        case "below_avg_cost": {
          if (avgCost > 0 && lastPrice < avgCost) {
            const dropPct = ((avgCost - lastPrice) / avgCost) * 100;
            if (dropPct >= threshold) {
              shouldTrigger = true;
              message = `${asset.ticker} está ${dropPct.toFixed(1)}% abaixo do custo médio — oportunidade de compra`;
            }
          }
          break;
        }
        case "above_target": {
          if (targetPrice !== null && lastPrice >= targetPrice) {
            shouldTrigger = true;
            message = `${asset.ticker} atingiu o preço-alvo de ${targetPrice.toFixed(2)} (atual: ${lastPrice.toFixed(2)})`;
          }
          break;
        }
        case "below_target": {
          if (targetPrice !== null && lastPrice <= targetPrice) {
            shouldTrigger = true;
            message = `${asset.ticker} caiu abaixo do preço-alvo de ${targetPrice.toFixed(2)} (atual: ${lastPrice.toFixed(2)})`;
          }
          break;
        }
        case "buy_opportunity": {
          // Preço < custo médio * (1 - threshold/100)
          if (avgCost > 0) {
            const buyLevel = avgCost * (1 - threshold / 100);
            if (lastPrice <= buyLevel) {
              shouldTrigger = true;
              message = `🟡 OPORTUNIDADE: ${asset.ticker} está ${threshold.toFixed(1)}% abaixo do custo médio — considere aumentar posição`;
            }
          }
          break;
        }
      }

      if (shouldTrigger) {
        await db
          .update(alerts)
          .set({
            status: "triggered",
            triggeredMessage: message,
            triggeredAt: new Date(),
          })
          .where(eq(alerts.id, alert.id));

        triggered.push({
          alertId: alert.id,
          ticker: asset.ticker,
          message,
          type: alert.type,
        });
      }
    }

    return { triggered };
  }),
});
