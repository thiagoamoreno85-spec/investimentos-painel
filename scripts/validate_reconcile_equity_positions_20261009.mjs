import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const expected = {
  BBDC4: { quantity: "1190.00000000", averageCost: "15.20700000", totalCost: "18096.33", lastPrice: "19.23000000", transactionCount: 3 },
  AXIA3: { quantity: "1149.00000000", averageCost: "42.10000000", totalCost: "48372.90", lastPrice: "56.90000000", transactionCount: 5 },
  AXIA7: { quantity: "131.00000000", averageCost: "30.10000000", totalCost: "3943.10", lastPrice: "56.69000000", transactionCount: 2 },
};

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const tickers = Object.keys(expected);
  const [assets] = await db.execute(
    `SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice
       FROM assets
      WHERE userId = 1 AND ticker IN (${tickers.map(() => "?").join(",")})`,
    tickers,
  );
  if (assets.length !== tickers.length) throw new Error("Ativo ausente na validação.");

  for (const ticker of tickers) {
    const asset = assets.find((row) => row.ticker === ticker);
    const target = expected[ticker];
    const fields = {
      totalQuantity: target.quantity,
      averageCost: target.averageCost,
      totalCost: target.totalCost,
      lastPrice: target.lastPrice,
    };
    for (const [field, value] of Object.entries(fields)) {
      if (String(asset[field]) !== value) {
        throw new Error(`${ticker}.${field}: esperado ${value}, encontrado ${asset[field]}`);
      }
    }
    const [countRows] = await db.execute(
      "SELECT COUNT(*) AS count FROM transactions WHERE userId = 1 AND assetId = ?",
      [asset.id],
    );
    if (Number(countRows[0].count) !== target.transactionCount) {
      throw new Error(`${ticker}: histórico de transações foi alterado indevidamente.`);
    }
  }

  const [cash] = await db.execute("SELECT balance FROM cash_balance WHERE userId = 1 LIMIT 1");
  if (!cash[0] || String(cash[0].balance) !== "6075.67") {
    throw new Error("Saldo de caixa foi alterado indevidamente.");
  }

  console.log("Validação aprovada: BBDC4, AXIA3 e AXIA7 reconciliados; preços, transações e caixa preservados.");
} finally {
  await db.end();
}
