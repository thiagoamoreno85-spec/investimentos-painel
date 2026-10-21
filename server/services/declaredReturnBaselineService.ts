import { and, desc, eq, gt, lte } from "drizzle-orm";
import { dailyPerformanceSnapshots, declaredReturnBaselines } from "../../drizzle/schema";
import { combineDeclaredReturnBaseline } from "../../shared/declaredReturnBaseline";
import { getDb } from "../db";
import { isOfficialPerformanceClose } from "../../shared/closedPerformanceSnapshot";

function brtDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${record.year}-${record.month}-${record.day}`;
}

/**
 * Retorna a última base monetária declarada e soma apenas fechamentos oficiais
 * posteriores. A base não converte uma estimativa em série histórica auditada.
 */
export async function getDeclaredReturnBaselineSummary(userId: number, asOfDate = brtDate()) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const [baseline] = await db.select().from(declaredReturnBaselines)
    .where(and(
      eq(declaredReturnBaselines.userId, userId),
      lte(declaredReturnBaselines.effectiveDate, asOfDate),
    ))
    .orderBy(desc(declaredReturnBaselines.effectiveDate), desc(declaredReturnBaselines.id))
    .limit(1);

  if (!baseline) return null;

  const closingRows = await db.select({
    snapshotDate: dailyPerformanceSnapshots.snapshotDate,
    returnValue: dailyPerformanceSnapshots.returnValue,
    status: dailyPerformanceSnapshots.status,
    capturedAt: dailyPerformanceSnapshots.capturedAt,
    valuationAsOf: dailyPerformanceSnapshots.valuationAsOf,
  }).from(dailyPerformanceSnapshots).where(and(
    eq(dailyPerformanceSnapshots.userId, userId),
    gt(dailyPerformanceSnapshots.snapshotDate, baseline.effectiveDate),
    lte(dailyPerformanceSnapshots.snapshotDate, asOfDate),
  )).orderBy(dailyPerformanceSnapshots.snapshotDate);

  const officialPoints = closingRows
    .filter(isOfficialPerformanceClose)
    .map((row) => ({
      date: row.snapshotDate,
      returnValueBRL: Number(row.returnValue),
    }));

  return {
    ...combineDeclaredReturnBaseline({
      effectiveDate: baseline.effectiveDate,
      returnValueBRL: Number(baseline.returnValue),
      notes: baseline.notes,
    }, officialPoints),
    declaredAt: baseline.declaredAt,
  };
}
