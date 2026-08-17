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
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  values.push(field);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
}

const aliases = new Map([
  ['INDA ETF', 'INDA'],
  ['NVIDIA', 'NVIDIA'],
  ['AXIA3', 'AXIA6'],
  ['XP FMP ELET3', 'ELET3'],
  ['BNP PARIBAS RUBI CIC RF CP', 'BNP_RUBI'],
  ['AZ QUEST VALORE FIRF CP', 'AZ_QUEST'],
  ['KINEA GAMA FIFI CIC EM AÇÕES RL', 'KINEA_GAMA'],
  ['TC COSMOS - GENIAL', 'TC_COSMOS'],
  ['TREND INVESTBACK FIC', 'TREND_INV'],
  ['BTC - LEDGER', 'BTC'],
  ['BTC - BINANCE', 'BTC_BINANCE'],
  ['ETHEREUM - LEDGER', 'ETH'],
  ['ETH - BINANCE', 'ETH_BINANCE'],
  ['SOL - LEDGER', 'SOL'],
  ['SOL - BINANCE', 'SOL_BINANCE'],
  ['CDB XP -AGO/28', 'CDB_XP_2028'],
  ['HDB ADR', 'HDB'],
  ['IBN ADR', 'IBN'],
  ['INFY ADR', 'INFY'],
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
]);

const sheetPositions = csv
  .map(parseCsvLine)
  .map(row => ({
    ...row,
    key: aliases.get(row.ticker.toUpperCase()) ?? row.ticker.toUpperCase(),
    quantity: Number(row.quantity),
    averageCost: row.average_cost === '' ? null : Number(row.average_cost),
  }));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [assets] = await conn.execute(
  'SELECT id, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost FROM assets WHERE userId = 1 ORDER BY ticker'
);
await conn.end();

const assetByTicker = new Map(assets.map(asset => [asset.ticker.toUpperCase(), asset]));
const compared = sheetPositions.map(position => {
  const asset = assetByTicker.get(position.key);
  if (!asset) return { ...position, status: 'MISSING_PANEL' };
  const panelQuantity = Number(asset.totalQuantity);
  const panelCost = Number(asset.averageCost);
  const qtyDiff = position.quantity - panelQuantity;
  const costDiff = position.averageCost == null ? null : position.averageCost - panelCost;
  const equalQty = Math.abs(qtyDiff) < 0.00000001;
  const equalCost = costDiff == null || Math.abs(costDiff) < 0.0001;
  return {
    ...position,
    status: equalQty && equalCost ? 'MATCH' : 'DIVERGENT',
    asset,
    panelQuantity,
    panelCost,
    qtyDiff,
    costDiff,
  };
});

const sheetKeys = new Set(sheetPositions.map(position => position.key));
const extraPanelAssets = assets.filter(asset => !sheetKeys.has(asset.ticker.toUpperCase()));
const divergent = compared.filter(position => position.status !== 'MATCH');

console.log(`POSICOES_PLANILHA=${sheetPositions.length}`);
console.log(`ATIVOS_PAINEL=${assets.length}`);
console.log(`DIVERGENCIAS=${divergent.length}`);
console.log('--- DIVERGENCIAS ---');
for (const item of divergent) {
  if (item.status === 'MISSING_PANEL') {
    console.log(`MISSING | ${item.ticker} | planilha qtd=${item.quantity} custo=${item.averageCost}`);
  } else {
    console.log(
      `DIFF | ${item.key} | planilha qtd=${item.quantity} custo=${item.averageCost} | painel qtd=${item.panelQuantity} custo=${item.panelCost} | dq=${item.qtyDiff} dc=${item.costDiff}`
    );
  }
}
console.log('--- EXTRAS_NO_PAINEL ---');
for (const asset of extraPanelAssets) {
  console.log(`EXTRA | ${asset.ticker} | qtd=${asset.totalQuantity} custo=${asset.averageCost} | ${asset.name}`);
}

process.exit(0);
