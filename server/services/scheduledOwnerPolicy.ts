export type ScheduledOwnerSource = "owner_open_id" | "admin_fallback";

export type ScheduledOwnerChoice<T> = {
  user: T;
  source: ScheduledOwnerSource;
};

export function chooseScheduledOwner<T>(
  configuredOwner: T | undefined,
  administrator: T | undefined
): ScheduledOwnerChoice<T> | null {
  if (configuredOwner) return { user: configuredOwner, source: "owner_open_id" };
  if (administrator) return { user: administrator, source: "admin_fallback" };
  return null;
}
