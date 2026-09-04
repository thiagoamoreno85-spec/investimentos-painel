export function parseBalanceVisibilityPreference(value: string | null): boolean {
  if (value === null) return true;

  try {
    return JSON.parse(value) !== false;
  } catch {
    return true;
  }
}
