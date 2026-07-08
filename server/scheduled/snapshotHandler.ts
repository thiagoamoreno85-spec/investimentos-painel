import { Request, Response } from "express";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { captureSnapshot } from "../services/snapshotService";

export async function snapshotHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const cronTaskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!cronTaskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    // Buscar todos os usuários com ativos para snapshot
    const allUsers = await db.select().from(users);
    const results: { userId: number; totalValue: number }[] = [];

    for (const user of allUsers) {
      try {
        const result = await captureSnapshot(user.id);
        results.push({ userId: user.id, totalValue: result.totalValue });
      } catch (err) {
        console.warn(`[SnapshotHandler] Failed for user ${user.id}:`, err);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[SnapshotHandler] Completed in ${elapsed}ms: ${results.length} snapshots captured`
    );

    return res.json({
      ok: true,
      taskUid: cronTaskUid,
      elapsed,
      snapshots: results.length,
      message: `${results.length} portfolio snapshots captured.`,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error("[SnapshotHandler] Error:", error);
    return res.status(500).json({ error: String(error), elapsed });
  }
}
