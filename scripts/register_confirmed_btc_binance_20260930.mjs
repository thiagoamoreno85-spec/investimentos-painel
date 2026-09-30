import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_BTC_BINANCE_20260930]";
const TRADE_DATE_UTC = "2026-09-30T20:13:05.000Z"; // 17:13:05 BRT, horário exibido no histórico Binance.
const trade = {
  ticker: "BTC_BIN",
  quantity: "0.00230000",
  unitPriceUsd: "83625.45000000",
  totalValueUsd: "192.34", // 0,0023 × 83.625,45 = US$ 192,338535; arredondado somente no campo monetário.
  expectedBeforeQuantity: "0.02141000",
  expectedAfterQuantity: "0.02371000",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [taggedTransactions] = await connection.execute(
    `SELECT id FROM transactions WHERE userId = ? AND notes LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (taggedTransactions.length) {
    throw new Error("Já existe lançamento com esta chave de origem; operação cancelada para impedir duplicidade.");
  }

  const [assets] = await connection.execute(
    `SELECT id, currency, totalQuantity, averageCost, totalCost
       FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
    [USER_ID, trade.ticker],
  );
  if (assets.length !== 1) {
    throw new Error(`Ativo ${trade.ticker}: esperado um cadastro; encontrados ${assets.length}.`);
  }

  const asset = assets[0];
  if (asset.currency !== "USD") throw new Error(`Ativo ${trade.ticker}: moeda esperada USD, encontrada ${asset.currency}.`);
  if (asset.totalQuantity !== trade.expectedBeforeQuantity) {
    throw new Error(`Quantidade atual diverge da prévia (${asset.totalQuantity}); operação cancelada para revisão.`);
  }
  if (asset.averageCost !== "0.00000000" || asset.totalCost !== "0.00") {
    throw new Error("Custo agregado BTC Binance deixou de estar não conciliado; operação cancelada para revisão.");
  }

  const transactionResult = await connection.execute(
    `INSERT INTO transactions (
      userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt
    ) VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?, NOW())`,
    [
      USER_ID,
      asset.id,
      trade.quantity,
      trade.unitPriceUsd,
      trade.totalValueUsd,
      TRADE_DATE_UTC,
      `Compra executada BTC/USDT a mercado | Binance | 30/09/2026 17:13:05 BRT | Preço: US$ 83.625,45/BTC | Valor da ordem: 0,0023 BTC | Custo agregado BTC Binance permanece não conciliado por instrução do usuário; conversão USDT/BRL não registrada. | ${SOURCE_TAG}`,
    ],
  );

  // Preserva o custo agregado em zero: há saldo legado de BTC Binance sem custo histórico conciliado.
  await connection.execute(
    `UPDATE assets SET totalQuantity = ?, updatedAt = NOW() WHERE id = ?`,
    [trade.expectedAfterQuantity, asset.id],
  );

  const [afterAssets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost, lastPrice, lastPriceUpdatedAt
       FROM assets WHERE id = ?`,
    [asset.id],
  );
  const after = afterAssets[0];
  if (
    !after ||
    after.ticker !== trade.ticker ||
    after.totalQuantity !== trade.expectedAfterQuantity ||
    after.averageCost !== "0.00000000" ||
    after.totalCost !== "0.00"
  ) {
    throw new Error("Validação pós-registro falhou; operação revertida.");
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: "registered",
    transactionId: transactionResult[0].insertId,
    cashMovementCreated: false,
    asset: after,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
