import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const USER_ID = 1;
const TRANSACTION_DATE = new Date('2026-09-01T15:20:00-03:00');

const operations = [
  { ticker: 'TWST', type: 'buy', quantity: 0.93136, unitPrice: 133.80, totalValue: 126.12, fees: 1.50, currency: 'USD', notes: 'Compra executada TWST a mercado | XP Global | 01/09/2026' },
  { ticker: 'URNM', type: 'buy', quantity: 7.00218, unitPrice: 55.14, totalValue: 387.60, fees: 1.50, currency: 'USD', notes: 'Compra executada URNM a mercado | XP Global | 01/09/2026' },
  { ticker: 'INDA', type: 'buy', quantity: 8.64686, unitPrice: 49.64, totalValue: 430.71, fees: 1.50, currency: 'USD', notes: 'Compra executada INDA a mercado | XP Global | 01/09/2026' },
  { ticker: 'SELIC_31', type: 'buy', quantity: 0.08, unitPrice: 19729.125, totalValue: 1578.33, fees: 0, currency: 'BRL', notes: 'Compra executada Tesouro Selic 2031 | XP | 01/09/2026' },
  { ticker: 'CDB_C6_IPCA_2029', type: 'buy', quantity: 3, unitPrice: 1063.01, totalValue: 3189.03, fees: 0, currency: 'BRL', notes: 'Aplicação executada CDB Banco C6 Consignado S.A. - FEV/2029 | IPCA+ 8,60% | venc. 09/02/2029 | XP | 01/09/2026' },
  { ticker: 'BTC_BIN', type: 'buy', quantity: 0.00189, unitPrice: 77122.81, totalValue: 145.75, fees: 0, currency: 'USD', notes: 'Compra executada BTC/USDT a mercado | Binance | 01/09/2026' },
  { ticker: 'ETH_BIN', type: 'buy', quantity: 0.0213, unitPrice: 2414.67, totalValue: 51.43, fees: 0, currency: 'USD', notes: 'Compra executada ETH/USDT a mercado | Binance | 01/09/2026' },
];

const reconciledPositions = [
  { ticker: 'TWST', totalQuantity: 10.07606, averageCost: 38.841, totalCost: 391.36 },
  { ticker: 'URNM', totalQuantity: 146.79695, averageCost: 57.833, totalCost: 8489.41 },
  { ticker: 'INDA', totalQuantity: 113.45150, averageCost: 49.779, totalCost: 5647.50 },
  { ticker: 'SELIC_31', totalQuantity: 3.08, averageCost: 11022.96753, totalCost: 33950.74, lastPrice: 11193.77273 },
  { ticker: 'CDB_C6_IPCA_2029', totalQuantity: 3, averageCost: 1063.01, totalCost: 3189.03, lastPrice: 1063.01 },
  // A planilha não contém custo histórico para os saldos legados de BTC/ETH na Binance.
  // Por isso, somente a quantidade é conciliada e o custo médio permanece desconhecido (zero).
  { ticker: 'BTC_BIN', totalQuantity: 0.02141, averageCost: 0, totalCost: 0 },
  { ticker: 'ETH_BIN', totalQuantity: 0.37690, averageCost: 0, totalCost: 0 },
];

async function getAsset(ticker) {
  const [rows] = await connection.execute(
    'SELECT id FROM assets WHERE userId = ? AND ticker = ? LIMIT 1',
    [USER_ID, ticker],
  );
  return rows[0] ?? null;
}

async function ensureCdbC6Asset() {
  const existing = await getAsset('CDB_C6_IPCA_2029');
  if (existing) return existing.id;

  const [result] = await connection.execute(
    `INSERT INTO assets (
      userId, ticker, name, assetClass, currency, totalQuantity, averageCost,
      totalCost, lastPrice, lastPriceUpdatedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, 'renda_fixa', 'BRL', 0, 0, 0, 0, NOW(), NOW(), NOW())`,
    [USER_ID, 'CDB_C6_IPCA_2029', 'CDB Banco C6 Consignado S.A. - FEV/2029 (IPCA+ 8,60%)'],
  );
  return result.insertId;
}

await connection.beginTransaction();
try {
  await ensureCdbC6Asset();

  let insertedTransactions = 0;
  for (const operation of operations) {
    const asset = await getAsset(operation.ticker);
    if (!asset) throw new Error(`Ativo não encontrado: ${operation.ticker}`);

    const [existing] = await connection.execute(
      'SELECT id FROM transactions WHERE userId = ? AND assetId = ? AND notes = ? LIMIT 1',
      [USER_ID, asset.id, operation.notes],
    );
    if (existing.length > 0) continue;

    await connection.execute(
      `INSERT INTO transactions (
        userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        USER_ID,
        asset.id,
        operation.type,
        operation.quantity.toFixed(8),
        operation.unitPrice.toFixed(8),
        operation.totalValue.toFixed(2),
        operation.fees.toFixed(2),
        TRANSACTION_DATE,
        operation.notes,
      ],
    );
    insertedTransactions += 1;
  }

  for (const position of reconciledPositions) {
    const asset = await getAsset(position.ticker);
    if (!asset) throw new Error(`Ativo não encontrado para reconciliação: ${position.ticker}`);
    const setLastPrice = position.lastPrice === undefined ? '' : ', lastPrice = ?, lastPriceUpdatedAt = NOW()';
    const values = [
      position.totalQuantity.toFixed(8),
      position.averageCost.toFixed(8),
      position.totalCost.toFixed(2),
    ];
    if (position.lastPrice !== undefined) values.push(position.lastPrice.toFixed(8));
    values.push(asset.id);
    await connection.execute(
      `UPDATE assets
       SET totalQuantity = ?, averageCost = ?, totalCost = ?${setLastPrice}, updatedAt = NOW()
       WHERE id = ?`,
      values,
    );
  }

  await connection.commit();
  console.log(JSON.stringify({
    insertedTransactions,
    intentionallyExcluded: [
      'CDB XP 14,10% AGO/2028: ordem em processamento',
      'USDT: conversão para compras, sem posição final',
      '0,00243 BTC: divergência da planilha não confirmada',
    ],
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
