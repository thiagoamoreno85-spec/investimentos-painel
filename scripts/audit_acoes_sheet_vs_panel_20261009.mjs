import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { writeFile } from "node:fs/promises";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const db = await createConnection(process.env.DATABASE_URL);
try {
  const [assets] = await db.execute(
    `SELECT ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice, lastPriceUpdatedAt, priceReferenceDate
       FROM assets
      WHERE userId = 1
      ORDER BY ticker`,
  );
  await writeFile("/tmp/painel_assets_20261009.json", JSON.stringify(assets, null, 2));
  console.log(`Exportados ${assets.length} ativos para /tmp/painel_assets_20261009.json`);
} finally {
  await db.end();
}
