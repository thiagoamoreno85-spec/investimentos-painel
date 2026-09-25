import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_RF_20260925]";
const expected = {
  CDB_PINE_IPCA_0825_0931: {
    name: "CDB Pine - SET/2031 (IPCA+ 8,25%)",
    quantity: "3.00000000",
    unitPrice: "1000.00000000",
    totalCost: "3000.00",
    issuer: "Banco Pine",
    maturityLabel: "set/2031",
  },
  CRA_MARFRIG_IPCA_1090_0731: {
    name: "CRA Marfrig - JUL/2031 (IPCA+ 10,90%)",
    quantity: "4.00000000",
    unitPrice: "1087.18250000",
    totalCost: "4348.73",
    issuer: "Marfrig",
    maturityLabel: "jul/2031",
  },
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [assets] = await connection.execute(
    `SELECT id, ticker, name, totalQuantity, averageCost, totalCost, lastPrice, issuer, maturityDate, maturityLabel, priceReferenceDate
       FROM assets
      WHERE userId = ? AND ticker IN ('CDB_PINE_IPCA_0825_0931', 'CRA_MARFRIG_IPCA_1090_0731')
      ORDER BY ticker`,
    [USER_ID],
  );
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
      WHERE userId = ? AND description LIKE ?
      ORDER BY id`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [cashBalance] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID],
  );

  if (assets.length !== 2) throw new Error(`Esperados 2 títulos; encontrados ${assets.length}.`);
  if (transactions.length !== 2) throw new Error(`Esperadas 2 transações; encontradas ${transactions.length}.`);
  if (cashMovements.length !== 2) throw new Error(`Esperados 2 movimentos de caixa; encontrados ${cashMovements.length}.`);

  for (const asset of assets) {
    const fields = expected[asset.ticker];
    if (!fields) throw new Error(`Ticker inesperado: ${asset.ticker}.`);
    if (
      asset.name !== fields.name ||
      asset.totalQuantity !== fields.quantity ||
      asset.averageCost !== fields.unitPrice ||
      asset.totalCost !== fields.totalCost ||
      asset.lastPrice !== fields.unitPrice ||
      asset.issuer !== fields.issuer ||
      asset.maturityLabel !== fields.maturityLabel
    ) {
      throw new Error(`Dados inválidos para ${asset.ticker}.`);
    }
  }

  const totalApplications = transactions.reduce((sum, transaction) => sum + Number(transaction.totalValue), 0);
  const totalCashMovements = cashMovements.reduce((sum, movement) => sum + Number(movement.amount), 0);
  if (totalApplications.toFixed(2) !== "7348.73" || totalCashMovements.toFixed(2) !== "7348.73") {
    throw new Error("Total das aplicações ou movimentos de caixa diverge de R$ 7.348,73.");
  }

  console.log(JSON.stringify({
    status: "valid",
    assets,
    transactions,
    cashMovements,
    cashBalance,
    cashBalanceChanged: false,
    totalApplications: totalApplications.toFixed(2),
  }, null, 2));
} finally {
  await connection.end();
}
