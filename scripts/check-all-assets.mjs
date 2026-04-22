import { createConnection } from "mysql2/promise";
// DATABASE_URL já está injetada como variável de ambiente pelo sistema

const conn = await createConnection(process.env.DATABASE_URL);
const [assets] = await conn.query("SELECT ticker, assetClass, currency, totalQuantity, averageCost, lastPrice FROM assets WHERE userId=1");
console.log("Todos os assets:");
let totalBRL = 0;
let totalCostBRL = 0;
const USD_BRL = 5.7;
for (const a of assets) {
  const qty = parseFloat(a.totalQuantity);
  const cost = parseFloat(a.averageCost);
  const price = parseFloat(a.lastPrice);
  const mult = a.currency === "USD" ? USD_BRL : 1;
  const valueBRL = qty * price * mult;
  const costBRL = qty * cost * mult;
  totalBRL += valueBRL;
  totalCostBRL += costBRL;
  console.log(`${a.ticker} | qty:${qty} | avgCost:${cost} | lastPrice:${price} | valueBRL:${valueBRL.toFixed(2)} | currency:${a.currency}`);
}
console.log(`\nTotal patrimônio: R$ ${totalBRL.toFixed(2)}`);
console.log(`Total custo: R$ ${totalCostBRL.toFixed(2)}`);
console.log(`Lucro: R$ ${(totalBRL - totalCostBRL).toFixed(2)} (${totalCostBRL > 0 ? (((totalBRL - totalCostBRL) / totalCostBRL) * 100).toFixed(1) : 0}%)`);
await conn.end();
