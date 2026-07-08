/**
 * Handler do endpoint Heartbeat para captura diária de snapshot do patrimônio.
 * Rota: POST /api/scheduled/portfolio-snapshot
 *
 * Chamado pelo Manus Heartbeat (sugestão de cron: "0 0 21 * * 1-5" — 21:00 UTC
 * = 18:00 BRT, após o fechamento da B3, dias úteis).
 * Captura o snapshot para o owner do projeto.
 */
import { Request, Response } from "express";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { eq } from "drizzle-orm";
import { captureSnapshot } from "../services/snapshotService";

export async function portfolioSnapshotHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Verificar que é uma chamada do cron (header x-manus-cron-task-uid)
    const cronTaskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!cronTaskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const ownerOpenId = ENV.ownerOpenId;
    if (!ownerOpenId) {
      return res.status(500).json({ error: "Owner not configured" });
    }

    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.openId, ownerOpenId))
      .limit(1);

    if (ownerRows.length === 0) {
      // Owner ainda não fez login — pular silenciosamente
      return res.json({
        ok: true,
        skipped: "owner-not-found",
        message: "Owner not registered yet, skipping snapshot.",
      });
    }

    const result = await captureSnapshot(ownerRows[0].id);

    const elapsed = Date.now() - startTime;
    console.log(
      `[PortfolioSnapshotHandler] ${result.updated ? "Updated" : "Created"} snapshot ${result.snapshotDate} in ${elapsed}ms — total R$ ${result.totalValue.toFixed(2)}`
    );

    return res.json({
      ok: true,
      taskUid: cronTaskUid,
      elapsed,
      ...result,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    console.error("[PortfolioSnapshotHandler] Error:", message);

    return res.status(500).json({
      error: message,
      context: {
        url: req.url,
        taskUid: req.headers["x-manus-cron-task-uid"],
      },
      timestamp: new Date().toISOString(),
      elapsed,
    });
  }
}
