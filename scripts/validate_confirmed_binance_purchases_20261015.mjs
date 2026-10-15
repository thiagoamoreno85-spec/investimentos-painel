import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_BINANCE_20261015]";
const expected = new Map([
  ["BTC_BIN", { quantity: "0.02763000", averageCost: "38073.72313793", totalCost: "995.25", transactionQuantity: "0.00149000", unitPrice: "82344.01000000", totalValue: "122.69" }],
  ["ETH_BIN", { quantity: "0.39420000", averageCost: "0.00000000", totalCost: "0.00", transactionQuantity: "0.01730000", unitPrice: "2424.62000000", totalValue: "41.95" }],
  ["SOL_BIN", { quantity: "7.99172400", averageCost: "0.00000000", totalCost: "0.00", transactionQuantity: "0.31600000", unitPrice: "105.57000000", totalValue: "33.36" }],
]);

const connection = await createConnection(process.env.DATABASE_URL);
try {
  const [assets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost
     FROM assets WHERE userId = ? AND ticker IN ('BTC_BIN', 'ETH_BIN', 'SOL_BIN') ORDER BY ticker`,
    [USER_ID],
  );
  if (assets.length !== expected.size) throw new Error(`Esperados ${expected.size} ativos, encontrados ${assets.length}.`);
  for (const asset of assets) {
    const check = expected.get(asset.ticker);
    if (!check || asset.totalQuantity !== check.quantity || asset.averageCost !== check.averageCost || asset.totalCost !== check.totalCost) {
      throw new Error(`Ativo inválido: ${JSON.stringify(asset)}`);
    }
  }

  const [transactions] = await connection.execute(
    `SELECT a.ticker, t.type, t.quantity, t.unitPrice, t.totalValue, t.fees, t.transactionDate
     FROM transactions t JOIN assets a ON a.id = t.assetId
     WHERE t.userId = ? AND t.notes LIKE ? ORDER BY t.id`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (transactions.length !== expected.size) throw new Error(`Esperadas ${expected.size} transações, encontradas ${transactions.length}.`);
  for (const transaction of transactions) {
    const check = expected.get(transaction.ticker);
    if (!check || transaction.type !== "buy" || transaction.quantity !== check.transactionQuantity || transaction.unitPrice !== check.unitPrice || transaction.totalValue !== check.totalValue || transaction.fees !== "0.00") {
      throw new Error(`Transação inválida: ${JSON.stringify(transaction)}`);
    }
  }

  const [cashRows] = await connection.execute(
    `SELECT type, category, amount, description FROM cash_movements WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (cashRows.length !== 1 || cashRows[0].type !== "saida" || cashRows[0].category !== "compra_ativo" || cashRows[0].amount !== "1000.00") {
    throw new Error(`Movimento de conversão inválido: ${JSON.stringify(cashRows)}`);
  }

  const [balances] = await connection.execute(`SELECT balance FROM cash_balance WHERE userId = ?`, [USER_ID]);
  if (balances.length !== 1 || balances[0].balance !== "2668.11") throw new Error(`Saldo atual de caixa inválido: ${JSON.stringify(balances)}`);

  console.log(JSON.stringify({ validated: true, assets, transactions, cashMovement: cashRows[0], cashBalance: balances[0].balance }, null, 2));
} finally {
  await connection.end();
}
