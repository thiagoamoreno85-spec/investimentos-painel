import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_COMPRAS_20261009]";
const ORDER_DATE_UTC = "2026-10-09T16:47:00.000Z"; // 13:47 BRT, horário das capturas.
const MATURITY_DATE_UTC = "2026-10-09T16:48:00.000Z"; // 13:48 BRT, horário da captura do crédito.
const TESOURO_DEBIT_DATE_UTC = "2026-10-13T16:00:00.000Z"; // 13h BRT, data prevista no comprovante.

const axia = {
  ticker: "AXIA3",
  quantity: "26.00000000",
  unitPrice: "59.49384615", // R$ 1.546,84 ÷ 26; preserva o total executado.
  totalValue: "1546.84",
  expected: {
    totalQuantity: "1078.00000000",
    averageCost: "42.57228200",
    totalCost: "45892.92",
  },
  after: {
    totalQuantity: "1104.00000000",
    averageCost: "42.97079710",
    totalCost: "47439.76",
  },
};

const cdbMaturity = {
  ticker: "CDB_PINE_1026",
  quantity: "1.00000000",
  grossValue: "3522.07",
  incomeTax: "100.23",
  expected: {
    totalQuantity: "1.00000000",
    averageCost: "2949.31000000",
    totalCost: "2949.31",
  },
  after: {
    totalQuantity: "0.00000000",
    averageCost: "0.00000000",
    totalCost: "0.00",
  },
};

const tesouro = {
  ticker: "TESOURO_SELIC_31",
  quantity: "0.18000000",
  unitPrice: "19991.88888889", // R$ 3.598,54 ÷ 0,18; custo unitário sem arredondamento intermediário.
  totalValue: "3598.54",
  expected: {
    totalQuantity: "1.00000000",
    averageCost: "33950.73000000",
    totalCost: "33950.73",
  },
  after: {
    totalQuantity: "1.18000000",
    averageCost: "31821.41525424",
    totalCost: "37549.27",
  },
};

const connection = await createConnection(process.env.DATABASE_URL);

async function getAssetForUpdate(ticker) {
  const [rows] = await connection.execute(
    `SELECT id, ticker, name, totalQuantity, averageCost, totalCost
       FROM assets
      WHERE userId = ? AND ticker = ?
      FOR UPDATE`,
    [USER_ID, ticker],
  );
  if (rows.length !== 1) throw new Error(`Ativo ${ticker} não encontrado ou duplicado.`);
  return rows[0];
}

function assertExpected(asset, expected) {
  for (const [field, value] of Object.entries(expected)) {
    if (asset[field] !== value) {
      throw new Error(
        `Estado inesperado de ${asset.ticker}.${field}: esperado ${value}, encontrado ${asset[field]}. Operação cancelada.`,
      );
    }
  }
}

async function updateAssetCalculations(assetId, after) {
  await connection.execute(
    `UPDATE assets
        SET totalQuantity = ?, averageCost = ?, totalCost = ?, updatedAt = NOW()
      WHERE id = ? AND userId = ?`,
    [after.totalQuantity, after.averageCost, after.totalCost, assetId, USER_ID],
  );
}

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

  const axiaAsset = await getAssetForUpdate(axia.ticker);
  const cdbAsset = await getAssetForUpdate(cdbMaturity.ticker);
  const tesouroAsset = await getAssetForUpdate(tesouro.ticker);
  assertExpected(axiaAsset, axia.expected);
  assertExpected(cdbAsset, cdbMaturity.expected);
  assertExpected(tesouroAsset, tesouro.expected);

  const [axiaTransaction] = await connection.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
     VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?, NOW())`,
    [
      USER_ID,
      axiaAsset.id,
      axia.quantity,
      axia.unitPrice,
      axia.totalValue,
      ORDER_DATE_UTC,
      `Compra executada | Ticker na ordem: AXIA3F (mercado fracionário); ativo econômico: AXIA3 | Quantidade: 26 | Total: R$ 1.546,84 | Preço unitário calculado: R$ 59,49384615 | Corretagem não indicada na captura; registrada como R$ 0,00 | ${SOURCE_TAG}`,
    ],
  );

  const [cdbTransaction] = await connection.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
     VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, NOW())`,
    [
      USER_ID,
      cdbAsset.id,
      cdbMaturity.quantity,
      cdbMaturity.grossValue,
      cdbMaturity.grossValue,
      cdbMaturity.incomeTax,
      MATURITY_DATE_UTC,
      `Resgate por vencimento | CDB Pine - OUT/2026 | Crédito bruto: R$ 3.522,07 | IR: R$ 100,23 | Crédito líquido: R$ 3.421,84 | ${SOURCE_TAG}`,
    ],
  );

  const [tesouroTransaction] = await connection.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
     VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?, NOW())`,
    [
      USER_ID,
      tesouroAsset.id,
      tesouro.quantity,
      tesouro.unitPrice,
      tesouro.totalValue,
      ORDER_DATE_UTC,
      `Compra com status de liquidação | Tesouro Selic 2031 | Quantidade: 0,18 | Total: R$ 3.598,54 | Custo unitário calculado: R$ 19.991,88888889 | Débito informado para 13/10/2026 até 13h | ${SOURCE_TAG}`,
    ],
  );

  await updateAssetCalculations(axiaAsset.id, axia.after);
  await updateAssetCalculations(cdbAsset.id, cdbMaturity.after);
  await updateAssetCalculations(tesouroAsset.id, tesouro.after);

  const cashRows = [
    ["entrada", "vencimento_rf", cdbMaturity.grossValue, `Vencimento de CDB | CDB Pine - OUT/2026 | Crédito bruto recebido na conta de investimento. | ${SOURCE_TAG}`, MATURITY_DATE_UTC],
    ["saida", "taxa", cdbMaturity.incomeTax, `IR sobre vencimento de CDB | CDB Pine - OUT/2026 | ${SOURCE_TAG}`, MATURITY_DATE_UTC],
    ["saida", "compra_ativo", axia.totalValue, `Compra executada | AXIA3F (mercado fracionário) → AXIA3 | Total: R$ 1.546,84 | Registro histórico: não altera o saldo atual de caixa, conciliado por extrato. | ${SOURCE_TAG}`, ORDER_DATE_UTC],
    ["saida", "compra_ativo", tesouro.totalValue, `Compra em liquidação | Tesouro Selic 2031 | Débito previsto em 13/10/2026 até 13h | Valor: R$ 3.598,54 | Registro histórico: não altera o saldo atual de caixa, conciliado por extrato. | ${SOURCE_TAG}`, TESOURO_DEBIT_DATE_UTC],
  ];

  const cashMovementIds = [];
  for (const [type, category, amount, description, date] of cashRows) {
    const [result] = await connection.execute(
      `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [USER_ID, type, category, amount, description, date],
    );
    cashMovementIds.push(result.insertId);
  }

  const [afterAssets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost
       FROM assets
      WHERE userId = ? AND ticker IN (?, ?, ?)
      ORDER BY ticker`,
    [USER_ID, axia.ticker, cdbMaturity.ticker, tesouro.ticker],
  );
  const byTicker = Object.fromEntries(afterAssets.map((asset) => [asset.ticker, asset]));
  for (const [ticker, expected] of [
    [axia.ticker, axia.after],
    [cdbMaturity.ticker, cdbMaturity.after],
    [tesouro.ticker, tesouro.after],
  ]) {
    const asset = byTicker[ticker];
    if (!asset || Object.entries(expected).some(([field, value]) => asset[field] !== value)) {
      throw new Error(`Validação pós-registro falhou para ${ticker}; operação revertida.`);
    }
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: "registered",
    transactionIds: {
      axia: axiaTransaction.insertId,
      cdbMaturity: cdbTransaction.insertId,
      tesouro: tesouroTransaction.insertId,
    },
    cashMovementIds,
    cashBalanceChanged: false,
    assets: afterAssets,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
