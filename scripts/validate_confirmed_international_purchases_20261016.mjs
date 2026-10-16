import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_XP_GLOBAL_20261016]";
const expectedAssets = {
  URNM: { totalQuantity: "163.23574000", averageCost: "57.38663604", totalCost: "9367.55" },
  INDA: { totalQuantity: "122.49862000", averageCost: "49.64121228", totalCost: "6080.98" },
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [assets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost, positionTrackingMode, reconciliationBaseQuantity, reconciliationBaseCost
       FROM assets
      WHERE userId = ? AND ticker IN ('URNM', 'INDA')
      ORDER BY ticker`,
    [USER_ID],
  );

  if (assets.length !== 2) throw new Error(`Esperados dois ativos, encontrados ${assets.length}.`);
  for (const asset of assets) {
    const expected = expectedAssets[asset.ticker];
    if (!expected) throw new Error(`Ativo inesperado: ${asset.ticker}.`);
    for (const [field, value] of Object.entries(expected)) {
      if (asset[field] !== value) {
        throw new Error(`${asset.ticker}.${field}: esperado ${value}, encontrado ${asset[field]}.`);
      }
    }
    if (asset.positionTrackingMode !== "reconciled") {
      throw new Error(`${asset.ticker}: regime reconciliado deveria ter sido preservado.`);
    }
  }

  const [transactions] = await connection.execute(
    `SELECT a.ticker, t.quantity, t.unitPrice, t.totalValue, t.fees, t.transactionDate, t.notes
       FROM transactions t
       JOIN assets a ON a.id = t.assetId
      WHERE t.userId = ? AND t.notes LIKE ?
      ORDER BY a.ticker`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (transactions.length !== 2) throw new Error(`Esperadas duas transações com a chave de origem, encontradas ${transactions.length}.`);

  const [cashMovements] = await connection.execute(
    `SELECT type, category, amount, date, description
       FROM cash_movements
      WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (cashMovements.length !== 1) throw new Error(`Esperado um movimento de câmbio, encontrados ${cashMovements.length}.`);
  const movement = cashMovements[0];
  if (movement.type !== "saida" || movement.category !== "outro" || movement.amount !== "4999.99") {
    throw new Error("Movimento de câmbio diverge do confirmado.");
  }

  const [cashBalances] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID],
  );

  console.log(JSON.stringify({
    status: "validated",
    sourceTag: SOURCE_TAG,
    assets,
    transactions,
    cashMovement: movement,
    currentBrlCashSnapshot: cashBalances[0] ?? null,
    note: "O movimento de câmbio foi histórico e não atualizou o saldo BRL conciliado.",
  }, null, 2));
} finally {
  await connection.end();
}
