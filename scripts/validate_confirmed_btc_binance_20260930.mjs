import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_BTC_BINANCE_20260930]";
const expected = {
  ticker: "BTC_BIN",
  quantity: "0.00230000",
  unitPrice: "83625.45000000",
  totalValue: "192.34",
  positionQuantity: "0.02371000",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [assets] = await connection.execute(
    `SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice, lastPriceUpdatedAt
       FROM assets WHERE userId = ? AND ticker = ?`,
    [USER_ID, expected.ticker],
  );
  const [transactions] = await connection.execute(
    `SELECT t.id, a.ticker, t.type, t.quantity, t.unitPrice, t.totalValue, t.fees, t.transactionDate, t.notes
       FROM transactions t JOIN assets a ON a.id = t.assetId
      WHERE t.userId = ? AND t.notes LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [cashMovements] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );

  if (assets.length !== 1) throw new Error(`Esperada uma posição BTC Binance; encontradas ${assets.length}.`);
  if (transactions.length !== 1) throw new Error(`Esperada uma transação BTC; encontradas ${transactions.length}.`);
  if (cashMovements.length !== 0) throw new Error(`Não deveria haver movimento de caixa; encontrados ${cashMovements.length}.`);

  const asset = assets[0];
  const transaction = transactions[0];
  if (
    asset.totalQuantity !== expected.positionQuantity ||
    asset.averageCost !== "0.00000000" ||
    asset.totalCost !== "0.00"
  ) {
    throw new Error("Posição ou custo agregado BTC Binance diverge da instrução confirmada.");
  }
  if (
    transaction.type !== "buy" ||
    transaction.quantity !== expected.quantity ||
    transaction.unitPrice !== expected.unitPrice ||
    transaction.totalValue !== expected.totalValue ||
    transaction.fees !== "0.00"
  ) {
    throw new Error("Dados da execução BTC divergem da captura.");
  }

  console.log(JSON.stringify({
    status: "valid",
    asset,
    transaction,
    cashMovementCreated: false,
  }, null, 2));
} finally {
  await connection.end();
}
