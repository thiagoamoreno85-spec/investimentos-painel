/**
 * Handler do endpoint Heartbeat para atualização automática de notícias.
 * Rota: POST /api/scheduled/news-refresh
 *
 * Este endpoint é chamado pelo Manus Heartbeat a cada 30 minutos.
 * Ele atualiza as notícias para o owner do projeto (userId = owner).
 */
import { Request, Response } from "express";
import { runNewsRefresh } from "../services/newsRefreshService";
import { sdk } from "../_core/sdk";
import { isAuthenticatedCron } from "../_core/cronAuth";
import { resolveScheduledOwner } from "../services/scheduledOwner";

export async function newsRefreshHandler(req: Request, res: Response) {
  const startTime = Date.now();
  let taskUid: string | undefined;

  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!isAuthenticatedCron(cronUser)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }
    taskUid = cronUser.taskUid;

    const owner = await resolveScheduledOwner();
    if (!owner) {
      return res.json({
        ok: true,
        skipped: "owner-not-found",
        message: "Nenhum proprietário elegível para a atualização de notícias.",
      });
    }

    // Executar o refresh de notícias
    const result = await runNewsRefresh(owner.user.id);

    const elapsed = Date.now() - startTime;
    console.log(`[NewsRefreshHandler] Completed in ${elapsed}ms:`, result.message);

    return res.json({
      ok: true,
      taskUid,
      ownerSource: owner.source,
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
        taskUid,
      },
      timestamp: new Date().toISOString(),
      elapsed,
    });
  }
}
