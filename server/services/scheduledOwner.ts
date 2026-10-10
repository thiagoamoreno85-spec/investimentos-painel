import { asc, eq } from "drizzle-orm";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { chooseScheduledOwner } from "./scheduledOwnerPolicy";

export type ScheduledOwnerSource = "owner_open_id" | "admin_fallback";

export type ScheduledOwner = {
  user: User;
  source: ScheduledOwnerSource;
};

/**
 * Resolve o proprietário para rotinas de sistema. Em produção, a plataforma
 * pode não injetar OWNER_OPEN_ID; nesse caso, usa o primeiro administrador
 * cadastrado de forma determinística.
 */
export async function resolveScheduledOwner(): Promise<ScheduledOwner | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let configuredOwner: User | undefined;
  if (ENV.ownerOpenId) {
    const configuredOwnerRows = await db
      .select()
      .from(users)
      .where(eq(users.openId, ENV.ownerOpenId))
      .limit(1);
    configuredOwner = configuredOwnerRows[0];
  }

  const administrators = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.id))
    .limit(1);

  const choice = chooseScheduledOwner(configuredOwner, administrators[0]);
  return choice ? { user: choice.user, source: choice.source } : null;
}
