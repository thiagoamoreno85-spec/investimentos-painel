import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

// Verificar quais ativos têm lastPrice = 0
const [zeros] = await conn.query("SELECT ticker, assetClass, currency, totalQuantity, averageCost, lastPrice FROM assets WHERE userId=1 AND (CAST(lastPrice AS DECIMAL(20,8)) = 0 OR lastPrice IS NULL)");
console.log("Ativos com lastPrice zerado:", zeros.length);
for (const a of zeros) {
  console.log(`  ${a.ticker} | class:${a.assetClass} | qty:${a.totalQuantity} | avgCost:${a.averageCost}`);
}

// Verificar total de ativos
const [total] = await conn.query("SELECT COUNT(*) as n FROM assets WHERE userId=1");
console.log("\nTotal de ativos:", total[0].n);

await conn.end();
