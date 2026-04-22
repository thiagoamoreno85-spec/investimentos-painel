import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Carregar .env manualmente
try {
  const envContent = readFileSync("/home/ubuntu/investimentos-painel/.env", "utf8");
  envContent.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
} catch {}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL não encontrada!");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// Verificar tabelas
const [tables] = await conn.query("SHOW TABLES");
console.log("Tabelas existentes:", tables.map((t) => Object.values(t)[0]));

// Verificar usuários
const [users] = await conn.query("SELECT id, name, email FROM users LIMIT 5");
console.log("\nUsuários:", JSON.stringify(users, null, 2));

// Verificar assets
const [assets] = await conn.query("SELECT * FROM assets LIMIT 5");
console.log("\nAssets:", assets.length, "registros");
if (assets.length > 0) console.log("Primeiro:", JSON.stringify(assets[0], null, 2));

// Verificar transactions
const [txns] = await conn.query("SELECT COUNT(*) as total FROM transactions");
console.log("\nTransações:", JSON.stringify(txns[0]));

// Verificar dividends
const [divs] = await conn.query("SELECT COUNT(*) as total FROM dividends");
console.log("Dividendos:", JSON.stringify(divs[0]));

// Verificar alerts
const [alts] = await conn.query("SELECT COUNT(*) as total FROM alerts");
console.log("Alertas:", JSON.stringify(alts[0]));

await conn.end();
