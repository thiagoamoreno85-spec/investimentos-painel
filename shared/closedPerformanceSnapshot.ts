export type PerformanceSnapshotForValidation = {
  snapshotDate: string;
  status: "final" | "intraday";
  capturedAt: Date | string;
  valuationAsOf: Date | string | null;
};

const BRT_TIME_ZONE = "America/Sao_Paulo";

function brtDate(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

/**
 * Um fechamento oficial precisa ter sido valorizado e capturado no próprio dia
 * de referência, em horário de São Paulo. Registros manuais/intradiários ou
 * preenchidos retroativamente permanecem armazenados, mas não entram nas
 * séries oficiais de retorno.
 */
export function isOfficialPerformanceClose(snapshot: PerformanceSnapshotForValidation): boolean {
  if (snapshot.status !== "final" || !snapshot.valuationAsOf) return false;
  return brtDate(snapshot.capturedAt) === snapshot.snapshotDate
    && brtDate(snapshot.valuationAsOf) === snapshot.snapshotDate;
}

export const closedPerformanceSnapshotInternals = { brtDate };
