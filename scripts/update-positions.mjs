/**
 * Script de atualização em lote de posições e custos médios
 * Dados fornecidos pelo usuário em 15/07/2026
 */
import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

// Mapeamento ticker -> { qty, cost, currency }
// Tickers do banco mapeados para os dados fornecidos
const updates = [
  // RV Nacional
  { ticker: 'SUZB3',      qty: 770,         cost: 58.57,       currency: 'BRL' },
  { ticker: 'KLBN11',     qty: 442,         cost: 18.74,       currency: 'BRL' },
  { ticker: 'BRAV3',      qty: 2241,        cost: 29.85,       currency: 'BRL' },
  { ticker: 'CMIN3',      qty: 21917,       cost: 4.86,        currency: 'BRL' },
  { ticker: 'VALE3',      qty: 1346,        cost: 63.45,       currency: 'BRL' },
  { ticker: 'BPAC11',     qty: 1147,        cost: 34.67,       currency: 'BRL' },
  { ticker: 'INBR32',     qty: 1037,        cost: 36.02,       currency: 'BRL' },
  { ticker: 'BBAS3',      qty: 2146,        cost: 20.41,       currency: 'BRL' },
  { ticker: 'BBDC4',      qty: 1042,        cost: 14.83,       currency: 'BRL' },
  { ticker: 'CXSE3',      qty: 1770,        cost: 12.23,       currency: 'BRL' },
  { ticker: 'AXIA6',      qty: 967,         cost: 41.05,       currency: 'BRL' },
  { ticker: 'AXIA7',      qty: 246,         cost: 30.10,       currency: 'BRL' },
  { ticker: 'AURE3',      qty: 353,         cost: 11.74,       currency: 'BRL' },
  { ticker: 'KEPL3',      qty: 4672,        cost: 8.29,        currency: 'BRL' },
  { ticker: 'TTEN3',      qty: 2675,        cost: 11.30,       currency: 'BRL' },
  { ticker: 'AGRO3',      qty: 735,         cost: 23.94,       currency: 'BRL' },
  { ticker: 'SOJA3',      qty: 1503,        cost: 11.74,       currency: 'BRL' },
  { ticker: 'MBRF3',      qty: 4120,        cost: 13.30,       currency: 'BRL' },
  { ticker: 'FLRY3',      qty: 641,         cost: 17.39,       currency: 'BRL' },
  { ticker: 'SBSP3',      qty: 3585,        cost: 14.11,       currency: 'BRL' },
  { ticker: 'ORVR3',      qty: 678,         cost: 31.66,       currency: 'BRL' },
  { ticker: 'CYRE3',      qty: 2679,        cost: 20.83,       currency: 'BRL' },
  { ticker: 'CYRE4',      qty: 507,         cost: 26.00,       currency: 'BRL' },
  { ticker: 'ZAVI11',     qty: 135,         cost: 9.71,        currency: 'BRL' },
  { ticker: 'XPML11',     qty: 115,         cost: 101.59,      currency: 'BRL' },
  // Fundos (qty=1, custo = valor total do fundo)
  { ticker: 'ELET3',      qty: 1,           cost: 24477.28,    currency: 'BRL' }, // XP FMP ELET3
  { ticker: 'BNP_RUBI',   qty: 1,           cost: 51781.68,    currency: 'BRL' },
  { ticker: 'AZ_QUEST',   qty: 1,           cost: 57993.59,    currency: 'BRL' },
  { ticker: 'KINEA_GAMA', qty: 1,           cost: 109166.39,   currency: 'BRL' },
  { ticker: 'TREND_INV',  qty: 1,           cost: 59.98,       currency: 'BRL' },
  { ticker: 'TC_COSMOS',  qty: 1,           cost: 19796.10,    currency: 'BRL' },
  { ticker: 'SISPRIME',   qty: 1,           cost: 4550.00,     currency: 'BRL' },
  { ticker: 'FGTS',       qty: 1,           cost: 0.00,        currency: 'BRL' },
  // RV EUA
  { ticker: 'NET',        qty: 10.22344,    cost: 76.36,       currency: 'USD' },
  { ticker: 'MSFT',       qty: 15.74321,    cost: 419.12,      currency: 'USD' },
  { ticker: 'GOOGL',      qty: 18.94594,    cost: 216.10,      currency: 'USD' },
  { ticker: 'MU',         qty: 13.12204,    cost: 101.23,      currency: 'USD' },
  { ticker: 'TSM',        qty: 16.62096,    cost: 141.96,      currency: 'USD' },
  { ticker: 'AAPL',       qty: 2.08198,     cost: 212.43,      currency: 'USD' },
  { ticker: 'NVIDIA',     qty: 26.80334,    cost: 194.95,      currency: 'USD' },
  { ticker: 'CRWV',       qty: 3.07791,     cost: 119.55,      currency: 'USD' },
  { ticker: 'SOUN',       qty: 6.13894,     cost: 9.45,        currency: 'USD' },
  { ticker: 'PGEN',       qty: 206.40620,   cost: 1.99,        currency: 'USD' },
  { ticker: 'TWST',       qty: 9.14470,     cost: 29.16,       currency: 'USD' },
  { ticker: 'UNH',        qty: 1.72027,     cost: 318.12,      currency: 'USD' },
  { ticker: 'ABBV',       qty: 0.84991,     cost: 203.48,      currency: 'USD' },
  { ticker: 'NEE',        qty: 1.56238,     cost: 70.41,       currency: 'USD' },
  { ticker: 'ENPH',       qty: 1.90064,     cost: 42.46,       currency: 'USD' },
  { ticker: 'PLTR',       qty: 5.25126,     cost: 136.57,      currency: 'USD' },
  { ticker: 'LMT',        qty: 2.16067,     cost: 515.95,      currency: 'USD' },
  { ticker: 'CRWD',       qty: 16.00000,    cost: 76.86,       currency: 'USD' },
  { ticker: 'TSLA',       qty: 10.56739,    cost: 194.77,      currency: 'USD' },
  { ticker: 'SPCX',       qty: 2.76261,     cost: 197.29,      currency: 'USD' },
  { ticker: 'AMZN',       qty: 9.42799,     cost: 186.33,      currency: 'USD' },
  { ticker: 'CVX',        qty: 16.28567,    cost: 161.62,      currency: 'USD' },
  { ticker: 'BAC',        qty: 33.97362,    cost: 31.76,       currency: 'USD' },
  { ticker: 'BANC',       qty: 59.63738,    cost: 14.52,       currency: 'USD' },
  // Índia
  { ticker: 'INDA',       qty: 13.950130,   cost: 52.04,       currency: 'USD' },
  { ticker: 'HDB',        qty: 2.932830,    cost: 35.48,       currency: 'USD' },
  { ticker: 'IBN',        qty: 1.040160,    cost: 31.73,       currency: 'USD' },
  { ticker: 'INFY',       qty: 11.535750,   cost: 17.64,       currency: 'USD' },
  // Urânio
  { ticker: 'URNM',       qty: 114.74370,   cost: 58.95,       currency: 'USD' },
  { ticker: 'URA',        qty: 4.43736,     cost: 52.45,       currency: 'USD' },
  // Cripto
  { ticker: 'BTC',        qty: 0.098712,    cost: 65592.45,    currency: 'USD' },
  { ticker: 'BTC_BIN',    qty: 0.019520,    cost: 0,           currency: 'USD' },
  { ticker: 'ETH',        qty: 2.626230,    cost: 3042.36,     currency: 'USD' },
  { ticker: 'ETH_BIN',    qty: 0.355600,    cost: 0,           currency: 'USD' },
  { ticker: 'SOL',        qty: 32.063260,   cost: 132.44,      currency: 'USD' },
  { ticker: 'SOL_BIN',    qty: 7.675724,    cost: 0,           currency: 'USD' },
  { ticker: 'AVAX',       qty: 31.39455,    cost: 38.65,       currency: 'USD' },
  { ticker: 'BNB',        qty: 1.56109,     cost: 3602.00,     currency: 'BRL' },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log('Conectado ao banco. Iniciando atualizações...\n');

  let updated = 0;
  let notFound = [];
  let skipped = [];

  for (const u of updates) {
    const totalCost = parseFloat((u.qty * u.cost).toFixed(2));
    
    // Buscar o ativo pelo ticker (case-insensitive)
    const [rows] = await conn.execute(
      'SELECT id, ticker, totalQuantity, averageCost, totalCost FROM assets WHERE UPPER(ticker) = UPPER(?) LIMIT 1',
      [u.ticker]
    );
    
    if (rows.length === 0) {
      notFound.push(u.ticker);
      continue;
    }
    
    const asset = rows[0];
    const currentQty = parseFloat(asset.totalQuantity);
    const currentCost = parseFloat(asset.averageCost);
    
    // Verificar se precisa atualizar
    const qtyDiff = Math.abs(currentQty - u.qty);
    const costDiff = Math.abs(currentCost - u.cost);
    
    if (qtyDiff < 0.0001 && costDiff < 0.01) {
      skipped.push(`${u.ticker} (sem mudança)`);
      continue;
    }
    
    await conn.execute(
      'UPDATE assets SET totalQuantity = ?, averageCost = ?, totalCost = ?, updatedAt = NOW() WHERE id = ?',
      [u.qty.toString(), u.cost.toString(), totalCost.toString(), asset.id]
    );
    
    console.log(`✅ ${u.ticker.padEnd(12)} qty: ${currentQty} → ${u.qty} | custo: ${currentCost.toFixed(4)} → ${u.cost} | total: R$${totalCost.toFixed(2)}`);
    updated++;
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   Atualizados: ${updated}`);
  console.log(`   Sem mudança: ${skipped.length}`);
  console.log(`   Não encontrados: ${notFound.length}`);
  if (notFound.length > 0) {
    console.log(`   Tickers não encontrados: ${notFound.join(', ')}`);
  }

  await conn.end();
}

main().catch(console.error);
