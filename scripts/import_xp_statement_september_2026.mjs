import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_XP_SET_2026]";
const RENTAL_PERIOD_END = new Date("2026-09-30T12:00:00.000Z");
const CASH_SNAPSHOT_AT = new Date("2026-10-01T17:10:00.000Z"); // 14:10 BRT, horário da consulta XP.
const CASH_SNAPSHOT_VALUE = "6075.67";

/** Valores líquidos por ativo, consolidados do extrato XP de setembro/2026. */
const RENTALS = [
  { ticker: "AURE3", gross: "0.16", irrf: "-0.03", fees: "-0.04", net: "0.09" },
  { ticker: "AXIA3", gross: "6.53", irrf: "-1.46", fees: "-1.96", net: "3.11" },
  { ticker: "BBAS3", gross: "0.94", irrf: "-0.20", fees: "-0.28", net: "0.46" },
  { ticker: "BRAV3", gross: "107.34", irrf: "-24.14", fees: "-32.98", net: "50.22" },
  { ticker: "CMIN3", gross: "3884.07", irrf: "-873.90", fees: "-1305.53", net: "1704.64" },
  { ticker: "CYRE3", gross: "317.31", irrf: "-71.38", fees: "-103.98", net: "141.95" },
  { ticker: "KLBN11", gross: "0.05", irrf: "-0.01", fees: "-0.01", net: "0.03" },
  { ticker: "MBRF3", gross: "911.07", irrf: "-204.95", fees: "-292.35", net: "413.77" },
  { ticker: "SBSP3", gross: "4.23", irrf: "-0.95", fees: "-1.26", net: "2.02" },
  { ticker: "SUZB3", gross: "0.24", irrf: "-0.05", fees: "-0.07", net: "0.12" },
  { ticker: "TTEN3", gross: "9.26", irrf: "-2.08", fees: "-2.78", net: "4.40" },
  { ticker: "VALE3", gross: "5.72", irrf: "-1.28", fees: "-1.71", net: "2.73" },
];

const INCOMES = [
  {
    ticker: "FLRY3",
    type: "dividendo",
    quantity: "591.00000000",
    totalValue: "76.99",
    paymentDate: new Date("2026-09-02T12:00:00.000Z"),
    description: "DIVIDENDOS DE CLIENTES FLRY3 S/ 591",
  },
  {
    ticker: "ZAVI11",
    type: "rendimento",
    quantity: "146.00000000",
    totalValue: "17.52",
    paymentDate: new Date("2026-09-14T12:00:00.000Z"),
    description: "RENDIMENTOS DE CLIENTES ZAVI11 S/ 146",
  },
  {
    ticker: "XPML11",
    type: "rendimento",
    quantity: "112.00000000",
    totalValue: "103.04",
    paymentDate: new Date("2026-09-25T12:00:00.000Z"),
    description: "RENDIMENTOS DE CLIENTES XPML11 S/ 112",
  },
];

const REIMBURSEMENTS = [
  { ticker: "BBDC4", totalValue: "16.32", paymentDate: new Date("2026-09-01T12:00:00.000Z"), description: "CREDITO DE REEMBOLSO DE EVENTO BRBBDCACNPR8" },
  { ticker: "VALE3", totalValue: "2363.84", paymentDate: new Date("2026-09-02T12:00:00.000Z"), description: "CREDITO DE REEMBOLSO DE EVENTO BRVALEACNOR0" },
  { ticker: "BBAS3", totalValue: "247.18", paymentDate: new Date("2026-09-11T12:00:00.000Z"), description: "CREDITO DE REEMBOLSO DE EVENTO BRBBASACNOR3" },
  { ticker: "BBDC4", totalValue: "553.82", paymentDate: new Date("2026-09-15T12:00:00.000Z"), description: "CREDITO DE REEMBOLSO DE EVENTO BRBBDCACNPR8" },
  { ticker: "FLRY3", totalValue: "211.91", paymentDate: new Date("2026-09-28T12:00:00.000Z"), description: "CREDITO DE REEMBOLSO DE EVENTO BRFLRYACNOR5" },
];

const RESCUE = {
  ticker: "AXIA3",
  amount: "2500.20",
  date: new Date("2026-09-22T12:00:00.000Z"),
  description: "PAGAMENTO DE RESGATE DE RENDA VARIÁVEL BRAXIAA05PC1",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function amountPerShare(totalValue, quantity) {
  return (Number(totalValue) / Number(quantity)).toFixed(8);
}

const requiredTickers = [...new Set([
  ...RENTALS.map((entry) => entry.ticker),
  ...INCOMES.map((entry) => entry.ticker),
  ...REIMBURSEMENTS.map((entry) => entry.ticker),
  RESCUE.ticker,
])];

const connection = await createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();

  const [existingDividends] = await connection.execute(
    `SELECT id FROM dividends WHERE userId = ? AND notes LIKE ? FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  const [existingCashMovements] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(existingDividends.length === 0, "Há proventos já importados com esta chave de origem; importação duplicada bloqueada.");
  assert(existingCashMovements.length === 0, "Há movimentos de caixa já importados com esta chave de origem; importação duplicada bloqueada.");

  const [assetRows] = await connection.execute(
    `SELECT id, ticker, totalQuantity
     FROM assets
     WHERE userId = ? AND ticker IN (${requiredTickers.map(() => "?").join(",")})
     FOR UPDATE`,
    [USER_ID, ...requiredTickers]
  );
  assert(assetRows.length === requiredTickers.length, "Nem todos os ativos da prévia foram localizados; importação cancelada.");
  const assetByTicker = new Map(assetRows.map((asset) => [asset.ticker, asset]));

  const importedDividendIds = [];
  for (const rental of RENTALS) {
    const asset = assetByTicker.get(rental.ticker);
    assert(asset, `Ativo de aluguel não localizado: ${rental.ticker}`);
    const quantity = String(asset.totalQuantity);
    const [result] = await connection.execute(
      `INSERT INTO dividends (
         userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes
       ) VALUES (?, ?, 'outro', ?, ?, ?, 'BRL', ?, ?, ?)`,
      [
        USER_ID,
        asset.id,
        amountPerShare(rental.net, quantity),
        quantity,
        rental.net,
        RENTAL_PERIOD_END,
        RENTAL_PERIOD_END,
        `Aluguel de ações — líquido consolidado de setembro/2026 | Bruto R$ ${rental.gross} | IRRF R$ ${rental.irrf} | Taxas de intermediação R$ ${rental.fees} | Valor por ação é derivado do saldo de posições no painel e serve apenas à compatibilidade do registro. | ${SOURCE_TAG}`,
      ]
    );
    importedDividendIds.push(result.insertId);
  }

  for (const income of INCOMES) {
    const asset = assetByTicker.get(income.ticker);
    assert(asset, `Ativo de provento não localizado: ${income.ticker}`);
    const [result] = await connection.execute(
      `INSERT INTO dividends (
         userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes
       ) VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?)`,
      [
        USER_ID,
        asset.id,
        income.type,
        amountPerShare(income.totalValue, income.quantity),
        income.quantity,
        income.totalValue,
        income.paymentDate,
        income.paymentDate,
        `Importado do extrato XP de setembro/2026 | ${income.description} | ${SOURCE_TAG}`,
      ]
    );
    importedDividendIds.push(result.insertId);
  }

  for (const reimbursement of REIMBURSEMENTS) {
    const asset = assetByTicker.get(reimbursement.ticker);
    assert(asset, `Ativo de reembolso não localizado: ${reimbursement.ticker}`);
    const quantity = String(asset.totalQuantity);
    const [result] = await connection.execute(
      `INSERT INTO dividends (
         userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes
       ) VALUES (?, ?, 'outro', ?, ?, ?, 'BRL', ?, ?, ?)`,
      [
        USER_ID,
        asset.id,
        amountPerShare(reimbursement.totalValue, quantity),
        quantity,
        reimbursement.totalValue,
        reimbursement.paymentDate,
        reimbursement.paymentDate,
        `Reembolso de evento corporativo importado do extrato XP de setembro/2026 | ${reimbursement.description} | Valor por ação derivado apenas para compatibilidade do registro; não classificar como dividendo ordinário. | ${SOURCE_TAG}`,
      ]
    );
    importedDividendIds.push(result.insertId);
  }

  const rescueAsset = assetByTicker.get(RESCUE.ticker);
  assert(rescueAsset, "Ativo do resgate não localizado: AXIA3");
  const [rescueResult] = await connection.execute(
    `INSERT INTO cash_movements (userId, type, category, amount, description, date)
     VALUES (?, 'entrada', 'resgate', ?, ?, ?)`,
    [
      USER_ID,
      RESCUE.amount,
      `Resgate de renda variável vinculado a ${RESCUE.ticker}; não classificado como provento e sem alteração de quantidade nesta importação | ${RESCUE.description} | ${SOURCE_TAG}`,
      RESCUE.date,
    ]
  );

  const [cashBalanceResult] = await connection.execute(
    `UPDATE cash_balance SET balance = ?, updatedAt = ? WHERE userId = ?`,
    [CASH_SNAPSHOT_VALUE, CASH_SNAPSHOT_AT, USER_ID]
  );
  assert(cashBalanceResult.affectedRows === 1, "Saldo de caixa não localizado para marcação pelo extrato.");

  await connection.commit();
  console.log(JSON.stringify({
    status: "committed",
    importedDividendRecords: importedDividendIds.length,
    importedRentalRecords: RENTALS.length,
    importedIncomeRecords: INCOMES.length,
    importedReimbursementRecords: REIMBURSEMENTS.length,
    rescueCashMovementId: rescueResult.insertId,
    cashSnapshot: { value: CASH_SNAPSHOT_VALUE, capturedAt: CASH_SNAPSHOT_AT.toISOString() },
    safeguards: {
      noPurchaseOrSaleTransactions: true,
      noCashMovementsForProventos: true,
      noFgtsChanges: true,
    },
  }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
