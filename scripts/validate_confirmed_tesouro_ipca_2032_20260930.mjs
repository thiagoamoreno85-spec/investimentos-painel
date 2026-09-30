import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_TESOURO_IPCA_2032_20260930]";
const expected = {
  ticker: "NTN_B_082032",
  name: "Tesouro IPCA+ 2032 (IPCA+ 7,59%)",
  quantity: "1.29000000",
  unitPrice: "3097.14728682",
  totalValue: "3995.32",
  issuer: "Tesouro Nacional",
  maturityLabel: "ago/2032",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  const [assets] = await connection.execute(
    `SELECT id, ticker, name, totalQuantity, averageCost, totalCost, lastPrice, issuer, maturityDate, maturityLabel, priceReferenceDate
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
    `SELECT id, type, category, amount, description, date
       FROM cash_movements WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [cashBalance] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID],
  );

  if (assets.length !== 1) throw new Error(`Esperado 1 título; encontrados ${assets.length}.`);
  if (transactions.length !== 1) throw new Error(`Esperada 1 transação; encontradas ${transactions.length}.`);
  if (cashMovements.length !== 1) throw new Error(`Esperado 1 movimento de caixa; encontrados ${cashMovements.length}.`);

  const asset = assets[0];
  if (
    asset.name !== expected.name ||
    asset.totalQuantity !== expected.quantity ||
    asset.averageCost !== expected.unitPrice ||
    asset.totalCost !== expected.totalValue ||
    asset.lastPrice !== expected.unitPrice ||
    asset.issuer !== expected.issuer ||
    asset.maturityLabel !== expected.maturityLabel
  ) {
    throw new Error("Dados do título divergentes da confirmação.");
  }

  const transaction = transactions[0];
  if (
    transaction.type !== "buy" ||
    transaction.quantity !== expected.quantity ||
    transaction.unitPrice !== expected.unitPrice ||
    transaction.totalValue !== expected.totalValue ||
    transaction.fees !== "0.00"
  ) {
    throw new Error("Dados da transação divergentes da confirmação.");
  }

  const cashMovement = cashMovements[0];
  if (cashMovement.type !== "saida" || cashMovement.category !== "compra_ativo" || cashMovement.amount !== expected.totalValue) {
    throw new Error("Dados do movimento de caixa divergentes da confirmação.");
  }

  console.log(JSON.stringify({
    status: "valid",
    asset,
    transaction,
    cashMovement,
    cashBalance,
    cashBalanceChanged: false,
  }, null, 2));
} finally {
  await connection.end();
}
