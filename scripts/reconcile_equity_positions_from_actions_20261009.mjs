import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const userId = 1;
const source = "[RECONCILIACAO_ACOES_TAM_20261009]";
const updates = [
  {
    ticker: "BBDC4",
    before: { quantity: "1182.00000000", averageCost: "15.20700000", totalCost: "17974.67" },
    after: { quantity: "1190.00000000", averageCost: "15.20700000", totalCost: "18096.33" },
  },
  {
    ticker: "AXIA3",
    before: { quantity: "1104.00000000", averageCost: "42.97079710", totalCost: "47439.76" },
    after: { quantity: "1149.00000000", averageCost: "42.10000000", totalCost: "48372.90" },
  },
  {
    ticker: "AXIA7",
    before: { quantity: "186.00000000", averageCost: "30.10000000", totalCost: "5598.60" },
    after: { quantity: "131.00000000", averageCost: "30.10000000", totalCost: "3943.10" },
  },
];

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();

  const [cashBefore] = await db.execute(
    "SELECT balance FROM cash_balance WHERE userId = ? LIMIT 1",
    [userId],
  );

  for (const update of updates) {
    const [rows] = await db.execute(
      `SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice
         FROM assets
        WHERE userId = ? AND ticker = ?
        FOR UPDATE`,
      [userId, update.ticker],
    );
    if (rows.length !== 1) throw new Error(`Ativo inválido para reconciliação: ${update.ticker}`);

    const asset = rows[0];
    const current = {
      quantity: String(asset.totalQuantity),
      averageCost: String(asset.averageCost),
      totalCost: String(asset.totalCost),
    };
    if (
      current.quantity !== update.before.quantity ||
      current.averageCost !== update.before.averageCost ||
      current.totalCost !== update.before.totalCost
    ) {
      throw new Error(
        `Pré-condição divergente em ${update.ticker}; nenhuma alteração foi gravada. ` +
          `Esperado ${JSON.stringify(update.before)}, encontrado ${JSON.stringify(current)}.`,
      );
    }

    const [result] = await db.execute(
      `UPDATE assets
          SET totalQuantity = ?, averageCost = ?, totalCost = ?, updatedAt = NOW()
        WHERE id = ? AND userId = ?`,
      [update.after.quantity, update.after.averageCost, update.after.totalCost, asset.id, userId],
    );
    if (result.affectedRows !== 1) throw new Error(`Não foi possível atualizar ${update.ticker}.`);
  }

  const [cashAfter] = await db.execute(
    "SELECT balance FROM cash_balance WHERE userId = ? LIMIT 1",
    [userId],
  );
  const beforeBalance = cashBefore[0] ? String(cashBefore[0].balance) : null;
  const afterBalance = cashAfter[0] ? String(cashAfter[0].balance) : null;
  if (beforeBalance !== afterBalance) throw new Error("Integridade violada: saldo de caixa foi alterado.");

  await db.commit();
  console.log(JSON.stringify({
    source,
    result: "reconciled",
    updated: updates.map(({ ticker, after }) => ({ ticker, ...after })),
    cashBalanceUnchanged: afterBalance,
    note: "Reconciliação direta dos campos calculados conforme planilha aprovada; não foram criadas transações, movimentações de caixa ou dados simulados.",
  }, null, 2));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
