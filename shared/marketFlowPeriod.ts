export type MarketFlowPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";

export type MarketFlowHistoryPoint = {
  snapshotDate: string;
  b3ReportedThrough: string;
  b3ForeignFlowBrl: number | string;
  b3DomesticFlowBrl: number | string;
  ewzFlowProxyUsd: number | string | null;
};

export type AggregatedMarketFlowPoint = {
  key: string;
  label: string;
  startDate: string;
  b3Foreign: number;
  b3Domestic: number;
  ewzProxy: number | null;
  b3Sessions: number;
  ewzObservations: number;
};

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function startOfWeek(value: Date) {
  const copy = new Date(value);
  const day = copy.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy;
}

function bucketForDate(date: string, period: MarketFlowPeriod) {
  const source = toUtcDate(date);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();

  if (period === "daily") {
    return { key: date, label: shortDate(date), startDate: date };
  }
  if (period === "weekly") {
    const startDate = toIsoDate(startOfWeek(source));
    return { key: startDate, label: `Sem. ${shortDate(startDate)}`, startDate };
  }
  if (period === "monthly") {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    return { key: startDate, label: `${MONTHS_PT[month]}/${String(year).slice(-2)}`, startDate };
  }
  if (period === "quarterly") {
    const quarter = Math.floor(month / 3) + 1;
    const startMonth = (quarter - 1) * 3;
    const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
    return { key: startDate, label: `T${quarter}/${String(year).slice(-2)}`, startDate };
  }
  if (period === "semiannual") {
    const semester = month < 6 ? 1 : 2;
    const startMonth = semester === 1 ? 0 : 6;
    const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
    return { key: startDate, label: `S${semester}/${String(year).slice(-2)}`, startDate };
  }
  return { key: String(year), label: String(year), startDate: `${year}-01-01` };
}

function numeric(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type MutableBucket = AggregatedMarketFlowPoint & { ewzTotal: number };

/**
 * Consolida os dois indicadores sem misturá-los: B3 é deduplicada pela data
 * efetivamente divulgada e EWZ conserva a data da observação de cotas.
 */
export function aggregateMarketFlows(
  points: MarketFlowHistoryPoint[],
  period: MarketFlowPeriod,
): AggregatedMarketFlowPoint[] {
  const validPoints = points
    .filter((point) => isIsoDate(point.snapshotDate))
    .sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));

  const b3ByReportedDate = new Map<string, MarketFlowHistoryPoint>();
  for (const point of validPoints) {
    if (!isIsoDate(point.b3ReportedThrough)) continue;
    b3ByReportedDate.set(point.b3ReportedThrough, point);
  }

  const buckets = new Map<string, MutableBucket>();
  const getBucket = (date: string) => {
    const definition = bucketForDate(date, period);
    const existing = buckets.get(definition.key);
    if (existing) return existing;
    const created: MutableBucket = {
      ...definition,
      b3Foreign: 0,
      b3Domestic: 0,
      ewzProxy: null,
      ewzTotal: 0,
      b3Sessions: 0,
      ewzObservations: 0,
    };
    buckets.set(definition.key, created);
    return created;
  };

  for (const point of Array.from(b3ByReportedDate.values())) {
    const bucket = getBucket(point.b3ReportedThrough);
    bucket.b3Foreign += numeric(point.b3ForeignFlowBrl);
    bucket.b3Domestic += numeric(point.b3DomesticFlowBrl);
    bucket.b3Sessions += 1;
  }

  for (const point of validPoints) {
    if (point.ewzFlowProxyUsd === null || point.ewzFlowProxyUsd === undefined) continue;
    const value = numeric(point.ewzFlowProxyUsd);
    const bucket = getBucket(point.snapshotDate);
    bucket.ewzTotal += value;
    bucket.ewzObservations += 1;
    bucket.ewzProxy = bucket.ewzTotal;
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .map(({ ewzTotal: _ewzTotal, ...bucket }) => bucket);
}

/** Retorna a leitura mais recente de cada indicador já consolidada no período ativo. */
export function summarizeLatestMarketFlowPeriod(points: AggregatedMarketFlowPoint[]) {
  let b3: AggregatedMarketFlowPoint | null = null;
  let ewz: AggregatedMarketFlowPoint | null = null;

  for (const point of points) {
    if (point.b3Sessions > 0) b3 = point;
    if (point.ewzProxy !== null) ewz = point;
  }

  return { b3, ewz };
}

export const MARKET_FLOW_PERIODS: Array<{ value: MarketFlowPeriod; label: string }> = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];
