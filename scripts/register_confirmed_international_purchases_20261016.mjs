import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_XP_GLOBAL_20261016]";
const PURCHASE_DATE_UTC = "2026-10-16T16:50:00.000Z"; // 13h50 BRT, horário das ordens.
const CONVERSION_DATE_UTC = "2026-10-16T16:48:00.000Z"; // 13h48 BRT, horário do comprovante.

const purchases = [
  {
    ticker: "URNM",
    quantity: "5.13825000",
    // Total liquidado de US$ 224,30 inclui US$ 1,50 de corretagem.
    // A corretora exibe US$ 43,36, mas o preço efetivo preserva a reconciliação do total.
    unitPrice: "43.36106651",
    totalValue: "222.80",
    fees: "1.50",
    displayPrice: "43.36",
    displayedTotal: "224.30",
    expectedBefore: { totalQuantity: "158.09749000", totalCost: "9143.25" },
    expectedAfter: { totalQuantity: "163.23574000", averageCost: "57.38663604", totalCost: "9367.55" },
  },
  {
    ticker: "INDA",
    quantity: "9.04712000",
    // Total liquidado de US$ 433,48 inclui US$ 1,50 de corretagem.
    unitPrice: "47.74779156",
    totalValue: "431.98",
    fees: "1.50",
    displayPrice: "47.75",
    displayedTotal: "433.48",
    expectedBefore: { totalQuantity: "113.45150000", totalCost: "5647.50" },
    expectedAfter: { totalQuantity: "122.49862000", averageCost: "49.64121228", totalCost: "6080.98" },
  },
];

const conversion = {
  amountBrl: "4999.99",
  usdPurchased: "954.75",
  vetBrlPerUsd: "5.2370",
  quotedExchangeBrlPerUsd: "5.0834",
  purchasedUsd: "657.78",
  residualUsd: "296.97",
};

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [existingTaggedTransactions] = await connection.execute(
    `SELECT id FROM transactions WHERE userId = ? AND notes LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );
  const [existingTaggedCashMovements] = await connection.execute(
    `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? LIMIT 1 FOR UPDATE`,
    [USER_ID, `%${SOURCE_TAG}%`],
  );

  if (existingTaggedTransactions.length || existingTaggedCashMovements.length) {
    throw new Error("Já existe lançamento com esta chave de origem; operação cancelada para impedir duplicidade.");
  }

  const assetIds = new Map();
  for (const purchase of purchases) {
    const [assets] = await connection.execute(
      `SELECT id, ticker, currency, totalQuantity, totalCost, positionTrackingMode
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
      throw new Error(`Ativo ${purchase.ticker}: posição/custo atuais divergem da prévia. Operação cancelada para revisão.`);
    }

    assetIds.set(purchase.ticker, asset.id);
  }

  const insertedTransactions = [];
  for (const purchase of purchases) {
    const [transactionResult] = await connection.execute(
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
        `Compra executada a mercado | XP Global | 16/10/2026 | Preço exibido: US$ ${purchase.displayPrice} | Total liquidado: US$ ${purchase.displayedTotal} | ${SOURCE_TAG}`,
      ],
    );
    insertedTransactions.push({ ticker: purchase.ticker, id: transactionResult.insertId });

    const [assetResult] = await connection.execute(
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
    if (assetResult.affectedRows !== 1) {
      throw new Error(`Ativo ${purchase.ticker}: atualização da posição não confirmada.`);
    }
  }

  // O painel não possui subconta de caixa em USD: registra-se a origem, sem alterar o caixa BRL conciliado.
  const [cashResult] = await connection.execute(
    `INSERT INTO cash_movements
      (userId, type, category, amount, description, date, createdAt)
     VALUES (?, 'saida', 'outro', ?, ?, ?, NOW())`,
    [
      USER_ID,
      conversion.amountBrl,
      `Conversão BRL→USD concluída: R$ ${conversion.amountBrl} → US$ ${conversion.usdPurchased} | VET R$ ${conversion.vetBrlPerUsd}/US$ | Câmbio cotado R$ ${conversion.quotedExchangeBrlPerUsd}/US$ | Compras URNM/INDA: US$ ${conversion.purchasedUsd}; saldo residual: US$ ${conversion.residualUsd} na conta internacional | ${SOURCE_TAG} | Registro histórico: não altera o saldo BRL corrente, conciliado por extrato.`,
      CONVERSION_DATE_UTC,
    ],
  );

  const [afterAssets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost
       FROM assets
      WHERE id IN (?, ?)
      ORDER BY ticker`,
    purchases.map(purchase => assetIds.get(purchase.ticker)),
  );

  for (const purchase of purchases) {
    const after = afterAssets.find(asset => asset.ticker === purchase.ticker);
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
    sourceTag: SOURCE_TAG,
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
