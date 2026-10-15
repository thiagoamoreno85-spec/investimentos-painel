import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_BINANCE_20261015]";
const expectedCashBalance = "2668.11";

const trades = [
  {
    ticker: "BTC_BIN",
    quantity: "0.00149000",
    unitPrice: "82344.01000000",
    totalValue: "122.69",
    expectedBeforeQuantity: "0.02614000",
    expectedAfterQuantity: "0.02763000",
    expectedAverageCost: "38073.72313793",
    expectedTotalCost: "995.25",
    transactionDate: "2026-10-15T15:29:11.000Z",
    description: "Compra executada BTC/USDT a mercado | Binance | 15/10/2026 12:29:11 BRT | 0,00149 BTC a 82.344,01 USDT/BTC | Custo de ordem: 122,69257490 USDT. Custo-base legado permanece não conciliado; a operação fica registrada no ledger."
  },
  {
    ticker: "ETH_BIN",
    quantity: "0.01730000",
    unitPrice: "2424.62000000",
    totalValue: "41.95",
    expectedBeforeQuantity: "0.37690000",
    expectedAfterQuantity: "0.39420000",
    expectedAverageCost: "0.00000000",
    expectedTotalCost: "0.00",
    transactionDate: "2026-10-15T15:29:20.000Z",
    description: "Compra executada ETH/USDT a mercado | Binance | 15/10/2026 12:29:20 BRT | 0,0173 ETH a 2.424,62 USDT/ETH | Custo de ordem: 41,94592600 USDT. Custo-base legado permanece não conciliado; a operação fica registrada no ledger."
  },
  {
    ticker: "SOL_BIN",
    quantity: "0.31600000",
    unitPrice: "105.57000000",
    totalValue: "33.36",
    expectedBeforeQuantity: "7.67572400",
    expectedAfterQuantity: "7.99172400",
    expectedAverageCost: "0.00000000",
    expectedTotalCost: "0.00",
    transactionDate: "2026-10-15T15:29:26.000Z",
    description: "Compra executada SOL/USDT a mercado | Binance | 15/10/2026 12:29:26 BRT | 0,316 SOL a 105,57 USDT/SOL | Custo de ordem: 33,36012000 USDT. Custo-base legado permanece não conciliado; a operação fica registrada no ledger."
  },
];

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [existing] = await connection.execute(
    `SELECT id FROM transactions WHERE userId = ? AND notes LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [existingCash] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (existing.length || existingCash.length) {
    throw new Error("Já existe lançamento com esta chave de origem; operação cancelada para impedir duplicidade.");
  }

  const [cashRows] = await connection.execute(
    `SELECT balance FROM cash_balance WHERE userId = ? FOR UPDATE`,
    [USER_ID],
  );
  if (cashRows.length !== 1 || cashRows[0].balance !== expectedCashBalance) {
    throw new Error(`Saldo de caixa diverge da prévia; esperado R$ ${expectedCashBalance}, encontrado ${cashRows[0]?.balance ?? "ausente"}.`);
  }

  const results = [];
  for (const trade of trades) {
    const [assets] = await connection.execute(
      `SELECT id, currency, totalQuantity, averageCost, totalCost
       FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
      [USER_ID, trade.ticker],
    );
    if (assets.length !== 1) throw new Error(`Ativo ${trade.ticker}: esperado um cadastro; encontrados ${assets.length}.`);

    const asset = assets[0];
    if (asset.currency !== "USD") throw new Error(`Ativo ${trade.ticker}: moeda esperada USD, encontrada ${asset.currency}.`);
    if (asset.totalQuantity !== trade.expectedBeforeQuantity) {
      throw new Error(`Ativo ${trade.ticker}: quantidade atual diverge da prévia (${asset.totalQuantity}).`);
    }
    if (asset.averageCost !== trade.expectedAverageCost || asset.totalCost !== trade.expectedTotalCost) {
      throw new Error(`Ativo ${trade.ticker}: custo-base foi alterado desde a prévia; operação cancelada.`);
    }

    const [transactionResult] = await connection.execute(
      `INSERT INTO transactions (
        userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt
      ) VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?, NOW())`,
      [USER_ID, asset.id, trade.quantity, trade.unitPrice, trade.totalValue, trade.transactionDate, `${trade.description} | ${SOURCE_TAG}`],
    );

    // Mantém o custo-base da posição reconciliada: somente a quantidade atual muda;
    // o custo das novas compras fica preservado no ledger de transações auditável.
    await connection.execute(
      `UPDATE assets SET totalQuantity = ?, updatedAt = NOW() WHERE id = ?`,
      [trade.expectedAfterQuantity, asset.id],
    );

    results.push({ ticker: trade.ticker, transactionId: transactionResult.insertId, quantity: trade.expectedAfterQuantity });
  }

  const [cashMovementResult] = await connection.execute(
    `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
     VALUES (?, 'saida', 'compra_ativo', '1000.00', ?, '2026-10-15T15:28:48.000Z', NOW())`,
    [
      USER_ID,
      `Conversão BRL/USDT executada na Binance | R$ 1.000,00 para 198,2 USDT a R$ 5,0459/USDT em 15/10/2026 12:28:48 BRT. Registro histórico; não altera o saldo atual de caixa, que foi conciliado separadamente. | ${SOURCE_TAG}`,
    ],
  );

  const [finalCash] = await connection.execute(`SELECT balance FROM cash_balance WHERE userId = ?`, [USER_ID]);
  if (finalCash[0]?.balance !== expectedCashBalance) throw new Error("O lançamento histórico não pode alterar o saldo atual de caixa.");

  await connection.commit();
  console.log(JSON.stringify({ status: "registered", trades: results, cashMovementId: cashMovementResult.insertId, cashBalance: finalCash[0].balance }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
