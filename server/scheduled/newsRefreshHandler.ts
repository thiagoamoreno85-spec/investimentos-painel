/**
 * Handler do endpoint Heartbeat para atualização automática de notícias.
 * Rota: POST /api/scheduled/news-refresh
 *
 * Este endpoint é chamado pelo Manus Heartbeat a cada 30 minutos.
 * Ele atualiza as notícias para o owner do projeto (userId = owner).
 */
import { Request, Response } from "express";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { eq } from "drizzle-orm";
import { runNewsRefresh } from "../services/newsRefreshService";

export async function newsRefreshHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Verificar que é uma chamada do cron (header x-manus-cron-task-uid)
    const cronTaskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!cronTaskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    // Buscar o owner do projeto pelo openId
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
        message: "Owner not registered yet, skipping news refresh.",
      });
    }

    const owner = ownerRows[0];

    // Executar o refresh de notícias
    const result = await runNewsRefresh(owner.id);

    const elapsed = Date.now() - startTime;
    console.log(`[NewsRefreshHandler] Completed in ${elapsed}ms:`, result.message);

    return res.json({
      ok: true,
      taskUid: cronTaskUid,
      elapsed,
      ...result,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[NewsRefreshHandler] Error:", message);

    return res.status(500).json({
      error: message,
      stack,
      context: {
        url: req.url,
        taskUid: req.headers["x-manus-cron-task-uid"],
      },
      timestamp: new Date().toISOString(),
      elapsed,
    });
  }
}
