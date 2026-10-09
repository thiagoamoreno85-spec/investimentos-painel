import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const TARGET = 2_075_392.00;
const FX = 4.9873;
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [assets] = await db.execute(
    `SELECT id, ticker, assetClass, currency, totalQuantity, averageCost, lastPrice
       FROM assets
      WHERE userId = 1 AND totalQuantity > 0`,
  );
  const [cashRows] = await db.execute("SELECT balance FROM cash_balance WHERE userId = 1 LIMIT 1");
  if (cashRows.length !== 1 || Number(cashRows[0].balance) !== 2635.72) {
    throw new Error(`Saldo de caixa inválido: ${cashRows[0]?.balance ?? "ausente"}.`);
  }

  const investmentValue = assets.reduce((sum, asset) => {
    const conversion = asset.currency === "USD" ? FX : 1;
    return sum + Number(asset.totalQuantity) * Number(asset.lastPrice) * conversion;
  }, 0);
  const total = investmentValue + Number(cashRows[0].balance);
  if (Math.abs(total - TARGET) > 0.005) {
    throw new Error(`Total divergente: ${total.toFixed(2)}; esperado ${TARGET.toFixed(2)}.`);
  }

  const bova = assets.find((asset) => asset.ticker === "BOVA11_PUT");
  if (!bova || Number(bova.totalQuantity) !== 1 || Number(bova.averageCost) !== 4000 || Number(bova.lastPrice) !== 2568.42) {
    throw new Error("Posição BOVA11_PUT não corresponde à planilha.");
  }
  const [bovaTransactions] = await db.execute(
    "SELECT COUNT(*) AS count FROM transactions WHERE userId = 1 AND assetId = ?",
    [bova.id],
  );
  if (Number(bovaTransactions[0].count) !== 0) {
    throw new Error("Foram criadas transações artificiais para BOVA11_PUT.");
  }

  const [cashChanges] = await db.execute(
    "SELECT COUNT(*) AS count FROM cash_movements WHERE userId = 1 AND description LIKE '%CONCILIACAO_INTEGRAL_TAM_20261009%'",
  );
  if (Number(cashChanges[0].count) !== 0) {
    throw new Error("Foram criados movimentos de caixa artificiais.");
  }

  console.log(JSON.stringify({
    assets: assets.length,
    investmentValue: investmentValue.toFixed(2),
    cashBalance: Number(cashRows[0].balance).toFixed(2),
    totalPatrimony: total.toFixed(2),
    usdBrl: FX.toFixed(4),
    status: "approved",
  }, null, 2));
} finally {
  await db.end();
}
