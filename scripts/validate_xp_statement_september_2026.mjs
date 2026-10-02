import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_XP_SET_2026]";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connection = await createConnection(process.env.DATABASE_URL);
try {
  const [dividendRows] = await connection.execute(
    `SELECT d.id, a.ticker, d.type, d.totalValue, d.paymentDate, d.notes
     FROM dividends d
     JOIN assets a ON a.id = d.assetId
     WHERE d.userId = ? AND d.notes LIKE ?
     ORDER BY d.id`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(dividendRows.length === 20, "Quantidade de proventos importados diverge da prévia.");

  const rentalRows = dividendRows.filter((row) => String(row.notes).includes("Aluguel de ações"));
  const reimbursementRows = dividendRows.filter((row) => String(row.notes).includes("Reembolso de evento corporativo"));
  const incomeRows = dividendRows.filter((row) => String(row.notes).includes("Importado do extrato XP"));

  const sum = (rows) => rows.reduce((total, row) => total + Number(row.totalValue), 0).toFixed(2);
  assert(rentalRows.length === 12 && sum(rentalRows) === "2323.54", "Total dos aluguéis líquidos diverge.");
  assert(reimbursementRows.length === 5 && sum(reimbursementRows) === "3393.07", "Total dos reembolsos diverge.");
  assert(incomeRows.length === 3 && sum(incomeRows) === "197.55", "Total dos dividendos e rendimentos diverge.");
  assert(sum(dividendRows) === "5914.16", "Total de proventos importados diverge.");

  const [cashRows] = await connection.execute(
    `SELECT id, type, category, amount, description, date
     FROM cash_movements
     WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(cashRows.length === 1, "Quantidade de movimentos de caixa da importação diverge.");
  const rescue = cashRows[0];
  assert(rescue.type === "entrada" && rescue.category === "resgate" && String(rescue.amount) === "2500.20", "Resgate AXIA3 divergente.");
  assert(String(rescue.description).includes("AXIA3"), "Vínculo do resgate AXIA3 ausente.");

  const [balanceRows] = await connection.execute(
    `SELECT balance, updatedAt FROM cash_balance WHERE userId = ?`,
    [USER_ID]
  );
  assert(balanceRows.length === 1, "Saldo de caixa não localizado.");
  assert(String(balanceRows[0].balance) === "6075.67", "Saldo disponível da XP divergente.");

  const [transactions] = await connection.execute(
    `SELECT COUNT(*) AS count FROM transactions WHERE userId = ? AND notes LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(Number(transactions[0].count) === 0, "Transação de compra ou venda indevida criada na importação.");

  const [fgtsRows] = await connection.execute(
    `SELECT totalQuantity, averageCost, totalCost, lastPrice FROM assets WHERE userId = ? AND ticker = 'FGTS'`,
    [USER_ID]
  );
  assert(fgtsRows.length === 1, "FGTS não localizado.");
  assert(String(fgtsRows[0].totalQuantity) === "1.00000000", "Quantidade do FGTS alterada indevidamente.");
  assert(String(fgtsRows[0].averageCost) === "50762.01000000", "Custo do FGTS alterado indevidamente.");
  assert(String(fgtsRows[0].lastPrice) === "57594.42000000", "Valor do FGTS alterado indevidamente.");

  console.log(JSON.stringify({
    status: "valid",
    dividends: {
      totalRecords: dividendRows.length,
      rentals: { records: rentalRows.length, total: sum(rentalRows) },
      incomes: { records: incomeRows.length, total: sum(incomeRows) },
      reimbursements: { records: reimbursementRows.length, total: sum(reimbursementRows) },
      total: sum(dividendRows),
    },
    rescue: { id: rescue.id, amount: rescue.amount, date: rescue.date },
    cashBalance: balanceRows[0],
    transactionsCreated: 0,
    fgts: fgtsRows[0],
  }, null, 2));
} finally {
  await connection.end();
}
