import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { isAuthenticatedCron } from "../_core/cronAuth";
import { resolveScheduledOwner } from "../services/scheduledOwner";
import { refreshMarketFlowSnapshot } from "../services/marketFlowService";

/** Atualiza diariamente os dados de fluxo da B3 e o proxy offshore do EWZ. */
export async function marketFlowRefreshHandler(req: Request, res: Response) {
  const startedAt = Date.now();
  let taskUid: string | undefined;
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!isAuthenticatedCron(cronUser)) return res.status(403).json({ error: "cron-only endpoint" });
    taskUid = cronUser.taskUid;

    const owner = await resolveScheduledOwner();
    if (!owner) {
      return res.json({ ok: true, skipped: "owner-not-found", message: "Nenhum proprietário elegível para atualização de fluxos." });
    }

    const result = await refreshMarketFlowSnapshot(owner.user.id);
    return res.json({ ok: true, taskUid, ownerSource: owner.source, elapsed: Date.now() - startedAt, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[MarketFlowRefreshHandler] Error:", message);
    return res.status(500).json({ error: message, taskUid, elapsed: Date.now() - startedAt });
  }
}
