import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const PLAN_PATH = "/home/ubuntu/investimentos-painel/research/plano_conciliacao_integral_20261009.json";
const USER_ID = 1;
const SOURCE = "[CONCILIACAO_INTEGRAL_TAM_20261009]";
const PRICE_REFERENCE_DATE = "2026-10-09 15:00:00";
const plan = JSON.parse(await readFile(PLAN_PATH, "utf8"));

function sameDecimal(actual, expected) {
  return Number(actual) === Number(expected);
}

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();

  for (const item of plan.updates.filter((update) => update.ticker !== "BOVA11_PUT")) {
    const [rows] = await db.execute(
      `SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice, currency
         FROM assets
        WHERE userId = ? AND ticker = ?
        FOR UPDATE`,
      [USER_ID, item.ticker],
    );
    if (rows.length !== 1) throw new Error(`Ativo não localizado: ${item.ticker}.`);
    const before = rows[0];
    const checks = [
      ["totalQuantity", before.totalQuantity, item.quantityBefore],
      ["averageCost", before.averageCost, item.averageCostBefore],
      ["totalCost", before.totalCost, item.totalCostBefore],
      ["lastPrice", before.lastPrice, item.lastPriceBefore],
      ["currency", before.currency, item.currencyBefore],
    ];
    for (const [field, actual, expected] of checks) {
      const matches = field === "currency" ? String(actual) === String(expected) : sameDecimal(actual, expected);
      if (!matches) {
        throw new Error(
          `Pré-condição divergente em ${item.ticker}.${field}; esperado ${expected}, encontrado ${actual}. Nenhuma alteração foi gravada.`,
        );
      }
    }

    const [result] = await db.execute(
      `UPDATE assets
          SET totalQuantity = ?, averageCost = ?, totalCost = ?, lastPrice = ?, currency = ?,
              priceReferenceDate = ?, lastPriceUpdatedAt = NOW(), updatedAt = NOW()
        WHERE id = ? AND userId = ?`,
      [
        item.quantityAfter,
        item.averageCostAfter,
        item.totalCostAfter,
        item.lastPriceAfter,
        item.currencyAfter,
        PRICE_REFERENCE_DATE,
        before.id,
        USER_ID,
      ],
    );
    if (result.affectedRows !== 1) throw new Error(`Falha ao reconciliar ${item.ticker}.`);
  }

  const bova = plan.updates.find((update) => update.ticker === "BOVA11_PUT");
  const [existingBova] = await db.execute(
    "SELECT id FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE",
    [USER_ID, bova.ticker],
  );
  if (existingBova.length > 0) throw new Error("BOVA11_PUT já existe; nenhuma alteração foi gravada.");
  const [bovaResult] = await db.execute(
    `INSERT INTO assets
      (userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice,
       lastPriceUpdatedAt, priceReferenceDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
    [
      USER_ID,
      bova.ticker,
      bova.name,
      bova.assetClass,
      bova.currencyAfter,
      bova.quantityAfter,
      bova.averageCostAfter,
      bova.totalCostAfter,
      bova.lastPriceAfter,
      PRICE_REFERENCE_DATE,
    ],
  );
  if (bovaResult.affectedRows !== 1) throw new Error("Falha ao criar a posição de BOVA11_PUT.");

  const [cashRows] = await db.execute("SELECT balance FROM cash_balance WHERE userId = ? FOR UPDATE", [USER_ID]);
  if (cashRows.length !== 1 || String(cashRows[0].balance) !== "6075.67") {
    throw new Error(`Saldo de caixa divergente; esperado 6075.67, encontrado ${cashRows[0]?.balance ?? "ausente"}.`);
  }
  const [cashResult] = await db.execute(
    "UPDATE cash_balance SET balance = ?, updatedAt = NOW() WHERE userId = ?",
    [plan.cashBalanceRequiredBRL, USER_ID],
  );
  if (cashResult.affectedRows !== 1) throw new Error("Falha ao reconciliar saldo de caixa.");

  await db.commit();
  console.log(JSON.stringify({
    source: SOURCE,
    referenceDate: plan.referenceDate,
    usdBrl: plan.usdBrl,
    reconciledExistingAssets: plan.updates.length - 1,
    registeredBovaPut: bovaResult.insertId,
    cashBalanceAfter: plan.cashBalanceRequiredBRL,
    targetTotalBRL: plan.targetTotalBRL,
    note: "Reconciliação direta a partir da planilha TAM revisada e do total final autorizado. Não foram criadas transações, proventos ou movimentos de caixa artificiais.",
  }, null, 2));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
