import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const EXPECTED = {
  AURY: { quantity: "101.99020000", averageCost: "13.80730000", totalCost: "1408.21", price: "0.31750000", value: "32.38" },
  FTT: { quantity: "7.27451300", averageCost: "62.06000000", totalCost: "451.46", price: "1.82000000", value: "13.24" },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connection = await createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute(
    `SELECT ticker, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice,
            priceReferenceDate,
            CAST(totalQuantity * lastPrice AS DECIMAL(18, 2)) AS markedValueUsd
     FROM assets WHERE userId = ? AND ticker IN ('AURY', 'FTT') ORDER BY ticker`,
    [USER_ID]
  );
  assert(rows.length === 2, "Os dois ativos de cripto não foram localizados.");
  for (const row of rows) {
    const expected = EXPECTED[row.ticker];
    assert(expected, `Ativo inesperado: ${row.ticker}`);
    assert(row.assetClass === "cripto" && row.currency === "USD", `Classe/moeda divergente: ${row.ticker}`);
    assert(String(row.totalQuantity) === expected.quantity, `Quantidade alterada indevidamente: ${row.ticker}`);
    assert(String(row.averageCost) === expected.averageCost, `Custo médio alterado indevidamente: ${row.ticker}`);
    assert(String(row.totalCost) === expected.totalCost, `Custo total alterado indevidamente: ${row.ticker}`);
    assert(String(row.lastPrice) === expected.price, `Preço corrigido incorreto: ${row.ticker}`);
    assert(String(row.markedValueUsd) === expected.value, `Valor marcado divergente: ${row.ticker}`);
    assert(new Date(row.priceReferenceDate).toISOString() === "2026-10-02T18:47:39.000Z", `Data-base divergente: ${row.ticker}`);
  }
  console.log(JSON.stringify({ status: "valid", prices: rows }, null, 2));
} finally { await connection.end(); }
