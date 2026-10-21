import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env" });

const USER_ID = 1;
const EFFECTIVE_DATE = "2026-10-21";
const RETURN_VALUE = "62720.96";
const NOTES = "Base manual declarada pelo investidor em 21/10/2026, referente ao retorno acumulado até o momento intradiário. Somar somente fechamentos oficiais estritamente posteriores a esta data; não rotular como série histórica auditada.";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  const [existing] = await connection.execute(
    "SELECT id, return_value AS returnValue, notes FROM declared_return_baselines WHERE user_id = ? AND effective_date = ? FOR UPDATE",
    [USER_ID, EFFECTIVE_DATE],
  );

  if (existing.length > 0) {
    const row = existing[0];
    if (Number(row.returnValue) !== Number(RETURN_VALUE) || row.notes !== NOTES) {
      throw new Error("Já existe uma base manual divergente para 21/10/2026; a operação foi interrompida sem sobrescrever o registro.");
    }
    await connection.commit();
    console.log(JSON.stringify({ status: "already_registered", row }, null, 2));
  } else {
    await connection.execute(
      `INSERT INTO declared_return_baselines
        (user_id, effective_date, return_value, notes, declared_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [USER_ID, EFFECTIVE_DATE, RETURN_VALUE, NOTES],
    );
    await connection.commit();
    console.log(JSON.stringify({
      status: "registered",
      userId: USER_ID,
      effectiveDate: EFFECTIVE_DATE,
      returnValueBRL: RETURN_VALUE,
      notes: NOTES,
    }, null, 2));
  }
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
