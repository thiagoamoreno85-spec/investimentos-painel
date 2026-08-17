import fs from 'node:fs';
import mysql from 'mysql2/promise';

const csvPath = new URL('../.tmp_acoes_positions.csv', import.meta.url);
const csv = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const headers = csv.shift().split(',');

function parseCsvLine(line) {
  const values = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      values.push(field);
      field = '';
    } else field += char;
  }
  values.push(field);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
}

function nullableNumber(value) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const aliases = new Map([
  ['INDA ETF', 'INDA'],
  ['NVIDIA', 'NVIDIA'],
  ['AXIA3', 'AXIA6'],
  ['XP FMP ELET3', 'ELET3'],
  ['BNP PARIBAS RUBI CIC RF CP', 'BNP_RUBI'],
  ['AZ QUEST VALORE FIRF CP', 'AZ_QUEST'],
  ['KINEA GAMA FIFI CIC EM AÇÕES RL', 'KINEA_GAMA'],
  ['TREND INVESTBACK FIC', 'TREND_INV'],
  ['TC COSMOS - GENIAL', 'TC_COSMOS'],
  ['HDB ADR', 'HDB'],
  ['IBN ADR', 'IBN'],
  ['INFY ADR', 'INFY'],
  ['BTC - LEDGER', 'BTC'],
  ['BTC - BINANCE', 'BTC_BIN'],
  ['ETHEREUM - LEDGER', 'ETH'],
  ['ETH - BINANCE', 'ETH_BIN'],
  ['SOL - LEDGER', 'SOL'],
  ['SOL - BINANCE', 'SOL_BIN'],
  ['PRÉ 15,31% AA', 'PRE_15_31'],
  ['PRE 15,05% AA', 'PRE_15_05'],
  ['PRÉ 14,90% AA', 'PRE_14_90'],
  ['IPCA+8,25%', 'IPCA_8_25_2'],
  ['IPCA+8,8%', 'IPCA_8_8'],
  ['IPCA+8,3%', 'IPCA_8_3'],
  ['IPCA+6,85', 'IPCA_6_85'],
  ['IPCA+6,55%', 'IPCA_6_55'],
  ['IPCA+7,01%', 'IPCA_7_01'],
  ['IPCA+7,95%', 'IPCA_7_95'],
  ['IPCA+7,4%', 'IPCA_7_4'],
  ['PRE 15%', 'PRE_15'],
  ['99.5% CDI ISENTO', 'CDI_ISENTO'],
  ['TESOURO SELIC 31', 'SELIC_31'],
  ['CDB XP -AGO/28', 'CDB_XP_2028'],
]);

const classForNewCrypto = new Map([
  ['AURY', { name: 'AURY', assetClass: 'cripto', currency: 'USD' }],
  ['FTT', { name: 'FTT', assetClass: 'cripto', currency: 'USD' }],
]);

const rows = csv
  .map(parseCsvLine)
  .map(row => ({
    sourceTicker: row.ticker.trim(),
    ticker: aliases.get(row.ticker.trim().toUpperCase()) ?? row.ticker.trim().toUpperCase(),
    quantity: Number(row.quantity),
    averageCost: nullableNumber(row.average_cost),
    priceReference: nullableNumber(row.price_reference),
  }))
  .filter(row => row.sourceTicker !== '#REF!' && row.sourceTicker !== 'STRIKE')
  .filter(row => Number.isFinite(row.quantity));

// Consolida as três aplicações independentes de Tesouro Selic 2031 em uma posição única no painel.
const positions = [];
for (const row of rows) {
  const current = positions.find(position => position.ticker === row.ticker);
  if (current && row.ticker === 'SELIC_31') {
    current.quantity += row.quantity;
    current.totalCost += row.quantity * row.averageCost;
    current.totalMarketValue += row.quantity * row.priceReference;
  } else if (current) {
    throw new Error(`Ticker duplicado não tratado: ${row.ticker}`);
  } else {
    positions.push({
      ...row,
      totalCost: row.averageCost == null ? null : row.quantity * row.averageCost,
      totalMarketValue: row.priceReference == null ? null : row.quantity * row.priceReference,
    });
  }
}

for (const position of positions) {
  if (position.ticker === 'SELIC_31') {
    position.averageCost = position.totalCost / position.quantity;
    position.priceReference = position.totalMarketValue / position.quantity;
  }
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [assets] = await conn.execute('SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice FROM assets WHERE userId = 1');
const assetByTicker = new Map(assets.map(asset => [asset.ticker.toUpperCase(), asset]));

let updated = 0;
let created = 0;
let unchanged = 0;
const changes = [];

for (const position of positions) {
  if (position.averageCost == null) {
    console.log(`SKIP | ${position.ticker}: sem custo médio na planilha`);
    continue;
  }
  const totalCost = Number(position.totalCost.toFixed(2));
  const existing = assetByTicker.get(position.ticker);

  if (!existing) {
    const template = classForNewCrypto.get(position.ticker);
    if (!template) {
      console.log(`SKIP | ${position.ticker}: ativo não encontrado e sem regra de criação`);
      continue;
    }
    await conn.query(
      `INSERT INTO assets (userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice, lastPriceUpdatedAt, createdAt, updatedAt)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        position.ticker,
        template.name,
        template.assetClass,
        template.currency,
        position.quantity.toFixed(8),
        position.averageCost.toFixed(8),
        totalCost.toFixed(2),
        (position.priceReference ?? position.averageCost).toFixed(8),
      ]
    );
    created += 1;
    changes.push(`CRIADO | ${position.ticker} | qtd=${position.quantity} | custo=${position.averageCost}`);
    continue;
  }

  const shouldUpdatePrice = ['fundos', 'renda_fixa'].includes(existing.assetClass) && position.priceReference != null;
  const targetPrice = shouldUpdatePrice ? position.priceReference : Number(existing.lastPrice);
  const isSame =
    Math.abs(Number(existing.totalQuantity) - position.quantity) < 0.00000001 &&
    Math.abs(Number(existing.averageCost) - position.averageCost) < 0.00000001 &&
    Math.abs(Number(existing.totalCost) - totalCost) < 0.01 &&
    (!shouldUpdatePrice || Math.abs(Number(existing.lastPrice) - targetPrice) < 0.00000001);

  if (isSame) {
    unchanged += 1;
    continue;
  }

  await conn.query(
    `UPDATE assets
     SET totalQuantity = ?, averageCost = ?, totalCost = ?, lastPrice = ?,
         lastPriceUpdatedAt = IF(?, NOW(), lastPriceUpdatedAt), updatedAt = NOW()
     WHERE id = ?`,
    [
      position.quantity.toFixed(8),
      position.averageCost.toFixed(8),
      totalCost.toFixed(2),
      targetPrice.toFixed(8),
      shouldUpdatePrice ? 1 : 0,
      existing.id,
    ]
  );
  updated += 1;
  changes.push(
    `ATUALIZADO | ${position.ticker} | qtd ${existing.totalQuantity} → ${position.quantity} | custo ${existing.averageCost} → ${position.averageCost}`
  );
}

// Baixas já comprovadas no histórico informado pelo usuário: venda total de SOJA3 e vencimento do CDB BMG.
for (const ticker of ['SOJA3', 'CDB32076NW3']) {
  const asset = assetByTicker.get(ticker);
  if (!asset || Number(asset.totalQuantity) === 0) continue;
  await conn.execute(
    'UPDATE assets SET totalQuantity = 0, averageCost = 0, totalCost = 0, lastPrice = 0, updatedAt = NOW() WHERE id = ?',
    [asset.id]
  );
  updated += 1;
  changes.push(`BAIXADO | ${ticker} | posição zerada conforme venda/vencimento já documentados`);
}

await conn.end();

console.log('=== SINCRONIZAÇÃO CONCLUÍDA ===');
console.log(`Atualizados: ${updated}`);
console.log(`Criados: ${created}`);
console.log(`Sem alteração: ${unchanged}`);
for (const change of changes) console.log(change);
process.exit(0);
