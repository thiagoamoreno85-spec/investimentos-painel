/**
 * Serviço de snapshot diário do patrimônio — compartilhado entre a mutation
 * tRPC (captura manual) e o endpoint Heartbeat (/api/scheduled/portfolio-snapshot).
 *
 * Um snapshot por usuário por dia: se já existir para a data, é atualizado
 * (última captura do dia vence).
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, getAssetsByUser } from "../db";
import { portfolioSnapshots, cashBalance } from "../../drizzle/schema";
import { fetchUsdBrl } from "../quotes";

const USD_CLASSES = ["rv_eua", "cripto", "uranio", "india"];

export interface SnapshotResult {
  snapshotDate: string;
  totalValue: number;
  totalCost: number;
  cash: number;
  usdBrl: number;
  classBreakdown: Record<string, number>;
  updated: boolean;
}

/** Calcula e persiste o snapshot de hoje para um usuário. */
export async function captureSnapshot(userId: number): Promise<SnapshotResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const assets = await getAssetsByUser(userId);
  const usdBrl = await fetchUsdBrl().catch(() => 5.7);

  const cashRows = await db
    .select()
    .from(cashBalance)
    .where(eq(cashBalance.userId, userId))
    .limit(1);
  const cash = cashRows.length > 0 ? Number(cashRows[0].balance) : 0;

  const classBreakdown: Record<string, number> = {};
  let totalValue = cash;
  let totalCost = 0;

  if (cash > 0) classBreakdown["caixa"] = cash;

  for (const asset of assets) {
    if (asset.assetClass === "caixa") continue;
    const qty = parseFloat(asset.totalQuantity || "0");
    const price = parseFloat(asset.lastPrice || asset.averageCost || "0");
    const avgCost = parseFloat(asset.averageCost || "0");
    const fx = USD_CLASSES.includes(asset.assetClass) ? usdBrl : 1;

    const valueBRL = qty * price * fx;
    totalValue += valueBRL;
    totalCost += qty * avgCost * fx;
    classBreakdown[asset.assetClass] =
      (classBreakdown[asset.assetClass] ?? 0) + valueBRL;
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);

  const existing = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        eq(portfolioSnapshots.snapshotDate, snapshotDate)
      )
    )
    .limit(1);

  const values = {
    totalValue: totalValue.toFixed(2),
    totalCost: totalCost.toFixed(2),
    cashBalance: cash.toFixed(2),
    usdBrl: usdBrl.toFixed(4),
    classBreakdown: JSON.stringify(classBreakdown),
  };

  let updated = false;
  if (existing.length > 0) {
    await db
      .update(portfolioSnapshots)
      .set(values)
      .where(eq(portfolioSnapshots.id, existing[0].id));
    updated = true;
  } else {
    await db.insert(portfolioSnapshots).values({
      userId,
      snapshotDate,
      ...values,
    });
  }

  return {
    snapshotDate,
    totalValue,
    totalCost,
    cash,
    usdBrl,
    classBreakdown,
    updated,
  };
}

/** Histórico de snapshots dos últimos `days` dias, em ordem cronológica. */
export async function getSnapshotHistory(userId: number, days: number = 365) {
  const db = await getDb();
  if (!db) return [];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        gte(portfolioSnapshots.snapshotDate, fromStr)
      )
    )
    .orderBy(portfolioSnapshots.snapshotDate);

  return rows.map((r) => ({
    date: r.snapshotDate,
    totalValue: Number(r.totalValue),
    totalCost: Number(r.totalCost),
    cash: Number(r.cashBalance),
    classBreakdown: r.classBreakdown
      ? (JSON.parse(r.classBreakdown) as Record<string, number>)
      : {},
  }));
}

/**
 * Busca o primeiro snapshot disponível do mês corrente (ou do mês especificado).
 * Usado para calcular a rentabilidade acumulada do mês: base = primeiro snapshot do mês.
 */
export async function getFirstSnapshotOfMonth(
  userId: number,
  year?: number,
  month?: number
): Promise<{ totalValue: number; classBreakdown: Record<string, number>; snapshotDate: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth(); // 0-indexed

  // Primeiro e último dia do mês
  const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0); // último dia do mês
  const lastDayStr = lastDay.toISOString().slice(0, 10);

  const { lte } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        gte(portfolioSnapshots.snapshotDate, firstDay),
        lte(portfolioSnapshots.snapshotDate, lastDayStr)
      )
    )
    .orderBy(portfolioSnapshots.snapshotDate)
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    snapshotDate: row.snapshotDate,
    totalValue: Number(row.totalValue),
    classBreakdown: row.classBreakdown
      ? (JSON.parse(row.classBreakdown) as Record<string, number>)
      : {},
  };
}

/**
 * Busca o Último snapshot disponível do mês ANTERIOR ao mês corrente.
 *
 * Esta é a base correta para calcular a rentabilidade mensal:
 * - No dia 1 do mês, rent = 0% (patrimônio atual ≈ fechamento do mês anterior)
 * - Ao longo do mês, acumula a variação em relação ao fechamento do mês anterior
 *
 * Exemplo: em julho/2026, busca o último snapshot de junho/2026.
 * Se não houver snapshot de junho, busca o snapshot mais recente antes de julho.
 */
export async function getLastSnapshotOfPreviousMonth(
  userId: number,
  year?: number,
  month?: number
): Promise<{ totalValue: number; classBreakdown: Record<string, number>; snapshotDate: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth(); // 0-indexed, mês CORRENTE

  // Último dia do mês ANTERIOR (= dia 0 do mês corrente)
  const lastDayPrevMonth = new Date(Date.UTC(y, m, 0));
  const lastDayPrevMonthStr = lastDayPrevMonth.toISOString().slice(0, 10);

  const { lte: lteOp } = await import('drizzle-orm');

  // Busca o snapshot mais recente ANTES do início do mês corrente
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        lteOp(portfolioSnapshots.snapshotDate, lastDayPrevMonthStr)
      )
    )
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    snapshotDate: row.snapshotDate,
    totalValue: Number(row.totalValue),
    classBreakdown: row.classBreakdown
      ? (JSON.parse(row.classBreakdown) as Record<string, number>)
      : {},
  };
}

/** Busca o snapshot de uma data específica. Retorna null se não encontrado. */
export async function getSnapshotByDate(
  userId: number,
  date: Date
): Promise<{ totalValue: number; classBreakdown: Record<string, number> } | null> {
  const db = await getDb();
  if (!db) return null;
  const dateStr = date.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        eq(portfolioSnapshots.snapshotDate, dateStr)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    totalValue: Number(row.totalValue),
    classBreakdown: row.classBreakdown
      ? (JSON.parse(row.classBreakdown) as Record<string, number>)
      : {},
  };
}

/**
 * Calcula a rentabilidade mensal encadeada (método de cotas / time-weighted return).
 *
 * Algoritmo:
 *   1. Busca o último snapshot do mês ANTERIOR como ponto de partida (base).
 *   2. Busca todos os snapshots do mês corrente em ordem cronológica.
 *   3. Para cada par consecutivo (base → snap1, snap1 → snap2, ...), calcula a variação:
 *        r_i = (valor_i - valor_{i-1}) / valor_{i-1}
 *   4. Encadeia as variações: rentabilidade = (1+r1)*(1+r2)*...*(1+rN) - 1
 *
 * Isso isola o retorno puro da carteira, eliminando o efeito de aportes e retiradas,
 * pois cada variação é calculada em relação ao saldo ANTERIOR ao evento de caixa.
 *
 * Retorna null se não houver snapshots suficientes para o cálculo.
 */
export async function getMonthlyChainedReturn(
  userId: number,
  year?: number,
  month?: number
): Promise<{
  chainedReturn: number;       // rentabilidade encadeada em % (ex: 2.94)
  snapshotCount: number;       // número de snapshots usados no cálculo
  baseDate: string | null;     // data do snapshot base (mês anterior)
  baseValue: number | null;    // valor do snapshot base
} | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth(); // 0-indexed, mês CORRENTE

  // Primeiro dia do mês corrente
  const firstDayCurrentMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;

  // Último dia do mês anterior
  const lastDayPrevMonth = new Date(Date.UTC(y, m, 0));
  const lastDayPrevMonthStr = lastDayPrevMonth.toISOString().slice(0, 10);

  // 1. Buscar o último snapshot do mês ANTERIOR (base)
  const baseRows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        lte(portfolioSnapshots.snapshotDate, lastDayPrevMonthStr)
      )
    )
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(1);

  // 2. Buscar todos os snapshots do mês corrente em ordem cronológica
  const currentMonthRows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        gte(portfolioSnapshots.snapshotDate, firstDayCurrentMonth)
      )
    )
    .orderBy(portfolioSnapshots.snapshotDate);

  // Montar a sequência completa: [base, snap1, snap2, ..., snapN]
  const sequence: { date: string; value: number }[] = [];

  if (baseRows.length > 0) {
    sequence.push({
      date: baseRows[0].snapshotDate,
      value: Number(baseRows[0].totalValue),
    });
  }

  for (const row of currentMonthRows) {
    sequence.push({
      date: row.snapshotDate,
      value: Number(row.totalValue),
    });
  }

  // Precisamos de pelo menos 2 pontos para calcular uma variação
  if (sequence.length < 2) return null;

  // 3. Calcular rentabilidade encadeada: produto de (1 + r_i) para cada par consecutivo
  let accumulated = 1.0;
  for (let i = 1; i < sequence.length; i++) {
    const prev = sequence[i - 1].value;
    const curr = sequence[i].value;
    if (prev > 0) {
      accumulated *= (1 + (curr - prev) / prev);
    }
  }

  const chainedReturn = (accumulated - 1) * 100;

  return {
    chainedReturn,
    snapshotCount: sequence.length,
    baseDate: sequence[0].date,
    baseValue: sequence[0].value,
  };
}
