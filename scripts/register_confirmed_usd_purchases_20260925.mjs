import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_USD_20260925]";
const PURCHASE_DATE_UTC = "2026-09-25T17:12:00.000Z"; // 14:12 BRT, horário exibido nas ordens.
const CONVERSION_DATE_UTC = "2026-09-25T17:04:00.000Z"; // 14:04 BRT, horário do comprovante de câmbio.

const purchases = [
  {
    ticker: "PGEN",
    quantity: "4.84197000",
    // Preço efetivo derivado do total liquidado de US$ 37,27; a tela arredonda para US$ 7,70.
    unitPrice: "7.69728024",
    totalValue: "37.27",
    fees: "0.00",
    expectedBefore: { totalQuantity: "206.40620000", totalCost: "411.16" },
    expectedAfter: { totalQuantity: "211.24817000", averageCost: "2.12276395", totalCost: "448.43" },
    displayPrice: "7.70",
  },
  {
    ticker: "URNM",
    quantity: "11.20163000",
    // Preço efetivo derivado do total liquidado de US$ 552,62 (inclui US$ 1,50 de corretagem).
    unitPrice: "49.19998250",
    totalValue: "551.12",
    fees: "1.50",
    expectedBefore: { totalQuantity: "146.79695000", totalCost: "8489.41" },
    expectedAfter: { totalQuantity: "157.99858000", averageCost: "57.22855231", totalCost: "9042.03" },
    displayPrice: "49.20",
  },
  {
    ticker: "INDA",
    quantity: "10.45369000",
    // Preço efetivo derivado do total liquidado de US$ 501,79 (inclui US$ 1,50 de corretagem).
    unitPrice: "47.85774210",
    totalValue: "500.29",
    fees: "1.50",
    expectedBefore: { totalQuantity: "113.45150000", totalCost: "5647.50" },
    expectedAfter: { totalQuantity: "123.90519000", averageCost: "49.62899456", totalCost: "6149.29" },
    displayPrice: "47.86",
  },
];

const conversion = {
  amountBrl: "5700.00",
  usdPurchased: "1063.23",
  vetBrlPerUsd: "5.3610",
  quotedExchangeBrlPerUsd: "5.2038",
  residualUsdFromExistingBalance: "28.45",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [existingTaggedTransactions] = await connection.execute(
    `SELECT id FROM transactions WHERE userId = ? AND notes LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [existingTaggedCashMovement] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );

  if (existingTaggedTransactions.length || existingTaggedCashMovement.length) {
    throw new Error("Já existe lançamento com esta chave de origem; operação cancelada para impedir duplicidade.");
  }

  const assetIds = new Map();
  for (const purchase of purchases) {
    const [assets] = await connection.execute(
      `SELECT id, ticker, currency, totalQuantity, averageCost, totalCost
         FROM assets
        WHERE userId = ? AND ticker = ?
        FOR UPDATE`,
      [USER_ID, purchase.ticker],
    );

    if (assets.length !== 1) {
      throw new Error(`Ativo ${purchase.ticker}: esperado um cadastro; encontrados ${assets.length}.`);
    }

    const asset = assets[0];
    if (asset.currency !== "USD") {
      throw new Error(`Ativo ${purchase.ticker}: moeda esperada USD, encontrada ${asset.currency}.`);
    }
    if (
      asset.totalQuantity !== purchase.expectedBefore.totalQuantity ||
      asset.totalCost !== purchase.expectedBefore.totalCost
    ) {
      throw new Error(
        `Ativo ${purchase.ticker}: posição/custo atuais divergem da prévia. Operação cancelada para revisão.`,
      );
    }

    assetIds.set(purchase.ticker, asset.id);
  }

  const insertedTransactions = [];
  for (const purchase of purchases) {
    const result = await connection.execute(
      `INSERT INTO transactions
        (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
       VALUES (?, ?, 'buy', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        USER_ID,
        assetIds.get(purchase.ticker),
        purchase.quantity,
        purchase.unitPrice,
        purchase.totalValue,
        purchase.fees,
        PURCHASE_DATE_UTC,
        `Compra executada a mercado | XP Global | 25/09/2026 | Preço exibido: US$ ${purchase.displayPrice} | Total liquidado: US$ ${(Number(purchase.totalValue) + Number(purchase.fees)).toFixed(2)} | ${SOURCE_TAG}`,
      ],
    );
    insertedTransactions.push({ ticker: purchase.ticker, id: result[0].insertId });

    await connection.execute(
      `UPDATE assets
          SET totalQuantity = ?, averageCost = ?, totalCost = ?, updatedAt = NOW()
        WHERE id = ?`,
      [
        purchase.expectedAfter.totalQuantity,
        purchase.expectedAfter.averageCost,
        purchase.expectedAfter.totalCost,
        assetIds.get(purchase.ticker),
      ],
    );
  }

  // O saldo de caixa do painel é conciliado por extrato e não possui subconta em USD.
  // A conversão é registrada como trilha histórica, sem modificar o saldo corrente em BRL.
  const [cashResult] = await connection.execute(
    `INSERT INTO cash_movements
      (userId, type, category, amount, description, date, createdAt)
     VALUES (?, 'saida', 'outro', ?, ?, ?, NOW())`,
    [
      USER_ID,
      conversion.amountBrl,
      `Conversão BRL→USD concluída: R$ ${conversion.amountBrl} → US$ ${conversion.usdPurchased} | VET R$ ${conversion.vetBrlPerUsd}/US$ | Câmbio cotado R$ ${conversion.quotedExchangeBrlPerUsd}/US$ | Compras do dia: US$ 1.091,68; diferença de US$ ${conversion.residualUsdFromExistingBalance} coberta por saldo prévio em dólar | ${SOURCE_TAG} | Registro histórico: não altera o saldo corrente de caixa, conciliado por extrato.`,
      CONVERSION_DATE_UTC,
    ],
  );

  const [afterAssets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost
       FROM assets
      WHERE id IN (?, ?, ?)
      ORDER BY ticker`,
    purchases.map((purchase) => assetIds.get(purchase.ticker)),
  );

  for (const purchase of purchases) {
    const after = afterAssets.find((asset) => asset.ticker === purchase.ticker);
    if (
      !after ||
      after.totalQuantity !== purchase.expectedAfter.totalQuantity ||
      after.averageCost !== purchase.expectedAfter.averageCost ||
      after.totalCost !== purchase.expectedAfter.totalCost
    ) {
      throw new Error(`Validação pós-registro falhou em ${purchase.ticker}; operação revertida.`);
    }
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: "registered",
    purchases: insertedTransactions,
    cashMovementId: cashResult.insertId,
    cashBalanceChanged: false,
    afterAssets,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
