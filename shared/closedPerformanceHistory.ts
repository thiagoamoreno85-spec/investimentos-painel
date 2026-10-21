export type ClosedDailyReturn = {
  date: string;
  returnPct: number;
};

export type ClosedPerformanceHistory = {
  fromDate: string | null;
  lastClosedDate: string | null;
  snapshotCount: number;
  history: Array<{ date: string; value: number }>;
};

/**
 * Constrói a série acumulada exclusivamente a partir de fechamentos já
 * persistidos. Não preenche lacunas, não interpola e não inclui intradiário.
 */
export function buildClosedPerformanceHistory(
  input: ClosedDailyReturn[],
): ClosedPerformanceHistory {
  const points = [...input]
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.returnPct))
    .sort((left, right) => left.date.localeCompare(right.date));

  if (points.length === 0) {
    return { fromDate: null, lastClosedDate: null, snapshotCount: 0, history: [] };
  }

  let compounded = 1;
  const latestByMonth = new Map<string, { date: string; value: number }>();

  for (const point of points) {
    compounded *= 1 + point.returnPct / 100;
    const month = point.date.slice(0, 7);
    latestByMonth.set(month, {
      date: month,
      value: Number(((compounded - 1) * 100).toFixed(8)),
    });
  }

  return {
    fromDate: points[0].date,
    lastClosedDate: points.at(-1)?.date ?? null,
    snapshotCount: points.length,
    history: Array.from(latestByMonth.values()),
  };
}
