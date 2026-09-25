import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_USD_20260925]";
const expectedAssets = {
  PGEN: { totalQuantity: "211.24817000", averageCost: "2.12276395", totalCost: "448.43" },
  URNM: { totalQuantity: "157.99858000", averageCost: "57.22855231", totalCost: "9042.03" },
  INDA: { totalQuantity: "123.90519000", averageCost: "49.62899456", totalCost: "6149.29" },
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [transactions] = await connection.execute(
    `SELECT t.id, a.ticker, t.type, t.quantity, t.unitPrice, t.totalValue, t.fees, t.transactionDate, t.notes
       FROM transactions t
       JOIN assets a ON a.id = t.assetId
      WHERE t.userId = ? AND t.notes LIKE ?
      ORDER BY a.ticker`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [cashMovements] = await connection.execute(
    `SELECT id, type, category, amount, description, date
       FROM cash_movements
      WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [assets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost, lastPrice, lastPriceUpdatedAt
       FROM assets
      WHERE userId = ? AND ticker IN ('PGEN', 'URNM', 'INDA')
      ORDER BY ticker`,
    [USER_ID],
  );
  const [cashBalance] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID],
  );

  if (transactions.length !== 3) throw new Error(`Esperadas 3 compras; encontradas ${transactions.length}.`);
  if (cashMovements.length !== 1) throw new Error(`Esperada 1 conversão; encontradas ${cashMovements.length}.`);

  for (const asset of assets) {
    const expected = expectedAssets[asset.ticker];
    if (!expected) throw new Error(`Ativo inesperado: ${asset.ticker}.`);
    for (const [field, value] of Object.entries(expected)) {
      if (asset[field] !== value) {
        throw new Error(`${asset.ticker}.${field} inválido: ${asset[field]} !== ${value}`);
      }
    }
  }

  const totalWithFees = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.totalValue) + Number(transaction.fees),
    0,
  );
  if (Number(totalWithFees.toFixed(2)) !== 1091.68) {
    throw new Error(`Total liquidado inválido: ${totalWithFees.toFixed(2)}.`);
  }
  if (cashMovements[0].amount !== "5700.00") {
    throw new Error(`Valor da conversão inválido: ${cashMovements[0].amount}.`);
  }

  console.log(JSON.stringify({
    status: "valid",
    purchases: transactions,
    conversion: cashMovements[0],
    positions: assets,
    cashBalance,
    cashBalanceChanged: false,
    totalLiquidatedUsd: totalWithFees.toFixed(2),
  }, null, 2));
} finally {
  await connection.end();
}
