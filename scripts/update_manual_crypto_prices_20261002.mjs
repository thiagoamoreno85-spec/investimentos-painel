import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const REFERENCE_AT = new Date("2026-10-02T18:47:39.000Z");
const UPDATES = [
  { ticker: "FTT", expectedLastPrice: "62.06000000", newPrice: "1.82000000" },
  { ticker: "AURY", expectedLastPrice: "13.80730000", newPrice: "0.31750000" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connection = await createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();

  for (const update of UPDATES) {
    const [rows] = await connection.execute(
      `SELECT id, ticker, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice
       FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
      [USER_ID, update.ticker]
    );
    assert(rows.length === 1, `Ativo não localizado ou duplicado: ${update.ticker}`);
    const asset = rows[0];
    assert(asset.assetClass === "cripto" && asset.currency === "USD", `Classe ou moeda inesperada em ${update.ticker}`);
    assert(String(asset.lastPrice) === update.expectedLastPrice, `Preço atual divergente em ${update.ticker}; correção cancelada para evitar sobrescrita.`);

    const [result] = await connection.execute(
      `UPDATE assets
       SET lastPrice = ?, lastPriceUpdatedAt = ?, priceReferenceDate = ?
       WHERE id = ? AND userId = ?`,
      [update.newPrice, REFERENCE_AT, REFERENCE_AT, asset.id, USER_ID]
    );
    assert(result.affectedRows === 1, `Falha ao atualizar ${update.ticker}`);
  }

  const [updated] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost, lastPrice,
            CAST(totalQuantity * lastPrice AS DECIMAL(18, 2)) AS markedValueUsd
     FROM assets WHERE userId = ? AND ticker IN ('FTT', 'AURY') ORDER BY ticker`,
    [USER_ID]
  );

  await connection.commit();
  console.log(JSON.stringify({
    status: "committed",
    source: "Valores manuais informados pelo usuário em 02/10/2026",
    referenceAt: REFERENCE_AT.toISOString(),
    assets: updated,
    safeguards: "Quantidade, custo médio e custo total preservados",
  }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
