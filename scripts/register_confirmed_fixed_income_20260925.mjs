import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_RF_20260925]";
const CONFIRMATION_DATE_UTC = "2026-09-25T20:19:00.000Z"; // Confirmação do usuário às 17:19 BRT.

const applications = [
  {
    ticker: "CDB_PINE_IPCA_0825_0931",
    name: "CDB Pine - SET/2031 (IPCA+ 8,25%)",
    issuer: "Banco Pine",
    maturityDate: "2031-09-24",
    maturityLabel: "set/2031",
    quantity: "3.00000000",
    unitPrice: "1000.00000000",
    totalValue: "3000.00",
    rate: "IPCA + 8,25%",
  },
  {
    ticker: "CRA_MARFRIG_IPCA_1090_0731",
    name: "CRA Marfrig - JUL/2031 (IPCA+ 10,90%)",
    issuer: "Marfrig",
    maturityDate: "2031-07-15",
    maturityLabel: "jul/2031",
    quantity: "4.00000000",
    unitPrice: "1087.18250000",
    totalValue: "4348.73",
    rate: "IPCA + 10,90%",
  },
];

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

  const assetIds = new Map();
  for (const application of applications) {
    const [existingAssets] = await connection.execute(
      `SELECT id FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
      [USER_ID, application.ticker],
    );
    if (existingAssets.length) {
      throw new Error(`Já existe cadastro para ${application.ticker}; operação cancelada.`);
    }

    const result = await connection.execute(
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
        CONFIRMATION_DATE_UTC,
        application.issuer,
        application.maturityDate,
        application.maturityLabel,
        CONFIRMATION_DATE_UTC,
      ],
    );
    assetIds.set(application.ticker, result[0].insertId);
  }

  const transactionIds = [];
  const cashMovementIds = [];
  for (const application of applications) {
    const assetId = assetIds.get(application.ticker);
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
        CONFIRMATION_DATE_UTC,
        `Aplicação efetivada | ${application.name} | Taxa: ${application.rate} | Vencimento: ${application.maturityDate} | Valor: R$ ${application.totalValue} | ${SOURCE_TAG}`,
      ],
    );
    transactionIds.push({ ticker: application.ticker, id: transactionResult[0].insertId });

    // O saldo corrente do painel é conciliado por extrato; registrar a saída sem alterá-lo evita saldo fictício.
    const cashMovementResult = await connection.execute(
      `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
       VALUES (?, 'saida', 'compra_ativo', ?, ?, ?, NOW())`,
      [
        USER_ID,
        application.totalValue,
        `Aplicação efetivada em renda fixa | ${application.name} | Taxa: ${application.rate} | Vencimento: ${application.maturityDate} | Registro histórico: não altera o saldo corrente de caixa, conciliado por extrato. | ${SOURCE_TAG}`,
        CONFIRMATION_DATE_UTC,
      ],
    );
    cashMovementIds.push({ ticker: application.ticker, id: cashMovementResult[0].insertId });
  }

  const [afterAssets] = await connection.execute(
    `SELECT ticker, name, totalQuantity, averageCost, totalCost, lastPrice, issuer, maturityDate, maturityLabel, priceReferenceDate
       FROM assets
      WHERE id IN (?, ?)
      ORDER BY ticker`,
    applications.map((application) => assetIds.get(application.ticker)),
  );

  for (const application of applications) {
    const asset = afterAssets.find((candidate) => candidate.ticker === application.ticker);
    if (
      !asset ||
      asset.totalQuantity !== application.quantity ||
      asset.averageCost !== application.unitPrice ||
      asset.totalCost !== application.totalValue ||
      asset.lastPrice !== application.unitPrice ||
      asset.issuer !== application.issuer ||
      asset.maturityLabel !== application.maturityLabel
    ) {
      throw new Error(`Validação pós-registro falhou em ${application.ticker}; operação revertida.`);
    }
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: "registered",
    transactions: transactionIds,
    cashMovements: cashMovementIds,
    cashBalanceChanged: false,
    assets: afterAssets,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
