import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_COMPRAS_20261009]";
const expectedAssets = {
  AXIA3: { totalQuantity: "1104.00000000", averageCost: "42.97079710", totalCost: "47439.76" },
  CDB_PINE_1026: { totalQuantity: "0.00000000", averageCost: "0.00000000", totalCost: "0.00" },
  TESOURO_SELIC_31: { totalQuantity: "1.18000000", averageCost: "31821.41525424", totalCost: "37549.27" },
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [assets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost
       FROM assets
      WHERE userId = ? AND ticker IN ('AXIA3', 'CDB_PINE_1026', 'TESOURO_SELIC_31')
      ORDER BY ticker`,
    [USER_ID],
  );
  if (assets.length !== 3) throw new Error(`Esperados 3 ativos auditados; encontrados ${assets.length}.`);
  for (const asset of assets) {
    const expected = expectedAssets[asset.ticker];
    if (!expected || Object.entries(expected).some(([field, value]) => asset[field] !== value)) {
      throw new Error(`Validação de ativo falhou para ${asset.ticker}: ${JSON.stringify(asset)}`);
    }
  }

  const [transactions] = await connection.execute(
    `SELECT a.ticker, t.type, t.quantity, t.unitPrice, t.totalValue, t.fees, t.transactionDate, t.notes
       FROM transactions t
       JOIN assets a ON a.id = t.assetId
      WHERE t.userId = ? AND t.notes LIKE ?
      ORDER BY t.id`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (transactions.length !== 3) throw new Error(`Esperadas 3 transações com chave de origem; encontradas ${transactions.length}.`);
  const transactionByTicker = Object.fromEntries(transactions.map((tx) => [tx.ticker, tx]));
  const expectedTransactions = {
    AXIA3: { type: "buy", quantity: "26.00000000", totalValue: "1546.84", fees: "0.00" },
    CDB_PINE_1026: { type: "sell", quantity: "1.00000000", totalValue: "3522.07", fees: "100.23" },
    TESOURO_SELIC_31: { type: "buy", quantity: "0.18000000", totalValue: "3598.54", fees: "0.00" },
  };
  for (const [ticker, expected] of Object.entries(expectedTransactions)) {
    const transaction = transactionByTicker[ticker];
    if (!transaction || Object.entries(expected).some(([field, value]) => transaction[field] !== value)) {
      throw new Error(`Validação de transação falhou para ${ticker}: ${JSON.stringify(transaction)}`);
    }
  }

  const [cashMovements] = await connection.execute(
    `SELECT type, category, amount, date, description
       FROM cash_movements
      WHERE userId = ? AND description LIKE ?
      ORDER BY id`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (cashMovements.length !== 4) throw new Error(`Esperados 4 movimentos de caixa; encontrados ${cashMovements.length}.`);
  const expectedCash = [
    ["entrada", "vencimento_rf", "3522.07"],
    ["saida", "taxa", "100.23"],
    ["saida", "compra_ativo", "1546.84"],
    ["saida", "compra_ativo", "3598.54"],
  ];
  for (let index = 0; index < expectedCash.length; index += 1) {
    const [type, category, amount] = expectedCash[index];
    const actual = cashMovements[index];
    if (!actual || actual.type !== type || actual.category !== category || actual.amount !== amount) {
      throw new Error(`Validação de movimento de caixa falhou no índice ${index}: ${JSON.stringify(actual)}`);
    }
  }

  const [cash] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID],
  );
  if (cash.length !== 1 || cash[0].balance !== "6075.67") {
    throw new Error(`Saldo atual de caixa foi alterado indevidamente: ${JSON.stringify(cash)}`);
  }

  console.log(JSON.stringify({
    status: "validated",
    assets,
    transactions,
    cashMovements,
    cashBalance: cash[0],
  }, null, 2));
} finally {
  await connection.end();
}
