export type CronIdentity = {
  isCron?: boolean;
  taskUid?: string | null;
};

/** Retorna verdadeiro apenas para chamadas autenticadas pela plataforma como cron. */
export function isAuthenticatedCron(
  user: CronIdentity | null | undefined
): user is CronIdentity & { isCron: true; taskUid: string } {
  return user?.isCron === true && typeof user.taskUid === "string" && user.taskUid.length > 0;
}
