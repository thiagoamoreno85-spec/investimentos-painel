import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_TESOURO_IPCA_2032_20260930]";
const APPLICATION_DATE_UTC = "2026-09-30T20:08:00.000Z"; // 17:08 BRT, horário da solicitação na captura.
const application = {
  ticker: "NTN_B_082032",
  name: "Tesouro IPCA+ 2032 (IPCA+ 7,59%)",
  issuer: "Tesouro Nacional",
  maturityDate: "2032-08-15",
  maturityLabel: "ago/2032",
  quantity: "1.29000000",
  unitPrice: "3097.14728682", // R$ 3.995,32 ÷ 1,29; custo unitário não arredondado para preservar o total liquidado.
  totalValue: "3995.32",
  rate: "IPCA + 7,59%",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [taggedTransactions] = await connection.execute(
    `SELECT id FROM transactions WHERE userId = ? AND notes LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [taggedCashMovements] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  if (taggedTransactions.length || taggedCashMovements.length) {
    throw new Error("Já existe lançamento com esta chave de origem; operação cancelada para impedir duplicidade.");
  }

  const [existingAsset] = await connection.execute(
    `SELECT id FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
    [USER_ID, application.ticker],
  );
  if (existingAsset.length) {
    throw new Error(`Já existe cadastro para ${application.ticker}; operação cancelada.`);
  }

  const assetResult = await connection.execute(
    `INSERT INTO assets (
      userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost,
      lastPrice, lastPriceUpdatedAt, issuer, maturityDate, maturityLabel, priceReferenceDate, createdAt, updatedAt
    ) VALUES (?, ?, ?, 'renda_fixa', 'BRL', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      USER_ID,
      application.ticker,
      application.name,
      application.quantity,
      application.unitPrice,
      application.totalValue,
      application.unitPrice,
      APPLICATION_DATE_UTC,
      application.issuer,
      application.maturityDate,
      application.maturityLabel,
      APPLICATION_DATE_UTC,
    ],
  );
  const assetId = assetResult[0].insertId;

  const transactionResult = await connection.execute(
    `INSERT INTO transactions (
      userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt
    ) VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?, NOW())`,
    [
      USER_ID,
      assetId,
      application.quantity,
      application.unitPrice,
      application.totalValue,
      APPLICATION_DATE_UTC,
      `Aplicação efetivada | ${application.name} | Taxa: ${application.rate} | Vencimento: ${application.maturityDate} | Valor: R$ ${application.totalValue} | ${SOURCE_TAG}`,
    ],
  );

  // O saldo corrente do painel é conciliado por extrato; registrar a saída sem modificá-lo evita saldo fictício.
  const cashMovementResult = await connection.execute(
    `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
     VALUES (?, 'saida', 'compra_ativo', ?, ?, ?, NOW())`,
    [
      USER_ID,
      application.totalValue,
      `Aplicação efetivada em renda fixa | ${application.name} | Taxa: ${application.rate} | Vencimento: ${application.maturityDate} | Registro histórico: não altera o saldo corrente de caixa, conciliado por extrato. | ${SOURCE_TAG}`,
      APPLICATION_DATE_UTC,
    ],
  );

  const [afterAssets] = await connection.execute(
    `SELECT ticker, name, totalQuantity, averageCost, totalCost, lastPrice, issuer, maturityDate, maturityLabel, priceReferenceDate
       FROM assets WHERE id = ?`,
    [assetId],
  );
  const after = afterAssets[0];
  if (
    !after ||
    after.ticker !== application.ticker ||
    after.totalQuantity !== application.quantity ||
    after.averageCost !== application.unitPrice ||
    after.totalCost !== application.totalValue ||
    after.lastPrice !== application.unitPrice ||
    after.issuer !== application.issuer ||
    after.maturityLabel !== application.maturityLabel
  ) {
    throw new Error("Validação pós-registro falhou; operação revertida.");
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: "registered",
    assetId,
    transactionId: transactionResult[0].insertId,
    cashMovementId: cashMovementResult[0].insertId,
    cashBalanceChanged: false,
    asset: after,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
