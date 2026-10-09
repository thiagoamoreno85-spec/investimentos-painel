import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const BEFORE = "2635.72";
const AFTER = "2668.11";
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();
  const [rows] = await db.execute("SELECT balance FROM cash_balance WHERE userId = 1 FOR UPDATE");
  if (rows.length !== 1 || String(rows[0].balance) !== BEFORE) {
    throw new Error(`Saldo de caixa divergente; esperado ${BEFORE}, encontrado ${rows[0]?.balance ?? "ausente"}.`);
  }
  const [result] = await db.execute(
    "UPDATE cash_balance SET balance = ?, updatedAt = NOW() WHERE userId = 1",
    [AFTER],
  );
  if (result.affectedRows !== 1) throw new Error("Falha ao ajustar o caixa residual.");
  await db.commit();
  console.log(JSON.stringify({ cashBefore: BEFORE, cashAfter: AFTER, usdBrlReference: "4.9870", targetTotalBRL: "2075392.00" }, null, 2));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
