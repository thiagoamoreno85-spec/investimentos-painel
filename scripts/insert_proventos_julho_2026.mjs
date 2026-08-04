/**
 * Script para inserir os proventos de julho 2026 extraídos do extrato XP 496056
 * Executar: node scripts/insert_proventos_julho_2026.mjs
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const USER_ID = 1; // thiagoamoreno

// Primeiro: criar o CRA MINERVA como ativo se não existir
const [craCheck] = await conn.execute("SELECT id FROM assets WHERE ticker = 'CRA025005V5'");
let craAssetId;
if (craCheck.length === 0) {
  console.log('Criando ativo CRA025005V5 (CRA Minerva)...');
  const [result] = await conn.execute(
    `INSERT INTO assets (userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice, createdAt, updatedAt)
     VALUES (?, 'CRA025005V5', 'CRA Minerva JUL/2030', 'renda_fixa', 'BRL', 1, 0, 0, 0, NOW(), NOW())`,
    [USER_ID]
  );
  craAssetId = result.insertId;
  console.log(`CRA criado com id: ${craAssetId}`);
} else {
  craAssetId = craCheck[0].id;
  console.log(`CRA já existe com id: ${craAssetId}`);
}

// Mapeamento ticker → assetId (verificado no banco)
const TICKER_MAP = {
  AURE3:       24,
  BBAS3:       9,
  BBDC4:       16,
  BPAC11:      6,
  BRAV3:       10,
  CMIN3:       3,
  CYRE3:       5,
  KLBN11:      23,
  MBRF3:       4,
  ORVR3:       8,
  SBSP3:       2,
  SUZB3:       14,
  TTEN3:       11,
  VALE3:       1,
  XPML11:      20,
  ZAVI11:      120001,
  CRA025005V5: craAssetId,
};

/**
 * Proventos de julho 2026
 * [data, ticker, tipo, valorBruto, IRRF, notas]
 * Para BTC: totalValue = valorBruto (bruto), notas incluem IRRF
 * Para JCP/FII/CRA: totalValue = valorBruto (já líquido de IR na fonte para FII)
 */
const proventos = [
  // JCP
  ['2026-07-01', 'BBDC4',       'jcp',       16.32, -0.00, 'JCP BBDC4 - 1.042 ações | Extrato XP JUL/2026'],
  ['2026-07-31', 'BBDC4',       'jcp',        3.29, -0.00, 'JCP BBDC4 - 10 ações | Extrato XP JUL/2026'],
  // FII - Rendimentos (isentos de IR para PF)
  ['2026-07-13', 'ZAVI11',      'rendimento', 16.20, -0.00, 'Rendimento FII ZAVI11 - 135 cotas | Extrato XP JUL/2026'],
  ['2026-07-24', 'XPML11',      'rendimento',103.04, -0.00, 'Rendimento FII XPML11 - 112 cotas | Extrato XP JUL/2026'],
  // CRA - Juros (isento de IR para PF)
  ['2026-07-15', 'CRA025005V5', 'outro',      72.00, -0.00, 'Juros CRA025005V5 MINERVA JUL/2030 | Extrato XP JUL/2026'],
  // BTC - Locação de ações (IRRF 22,5% retido na fonte)
  ['2026-07-01', 'SUZB3',  'outro',   2.98, -0.67, 'BTC SUZB3 | IRRF: R$0,67 | Extrato XP JUL/2026'],
  ['2026-07-01', 'KLBN11', 'outro',   0.07, -0.01, 'BTC KLBN11 | IRRF: R$0,01 | Extrato XP JUL/2026'],
  ['2026-07-06', 'VALE3',  'outro',   0.83, -0.18, 'BTC VALE3 | IRRF: R$0,18 | Extrato XP JUL/2026'],
  ['2026-07-08', 'ORVR3',  'outro',   0.31, -0.06, 'BTC ORVR3 | IRRF: R$0,06 | Extrato XP JUL/2026'],
  ['2026-07-10', 'MBRF3',  'outro', 437.31,-98.37, 'BTC MBRF3 | IRRF: R$98,37 | Extrato XP JUL/2026'],
  ['2026-07-16', 'SBSP3',  'outro',   6.37, -1.43, 'BTC SBSP3 | IRRF: R$1,43 | Extrato XP JUL/2026'],
  ['2026-07-16', 'CMIN3',  'outro',  50.04,-11.25, 'BTC CMIN3 | IRRF: R$11,25 | Extrato XP JUL/2026'],
  ['2026-07-16', 'BBAS3',  'outro',   0.72, -0.16, 'BTC BBAS3 | IRRF: R$0,16 | Extrato XP JUL/2026'],
  ['2026-07-17', 'SUZB3',  'outro',   5.14, -1.15, 'BTC SUZB3 | IRRF: R$1,15 | Extrato XP JUL/2026'],
  ['2026-07-17', 'KLBN11', 'outro',   0.21, -0.04, 'BTC KLBN11 | IRRF: R$0,04 | Extrato XP JUL/2026'],
  ['2026-07-22', 'KLBN11', 'outro',  14.14, -3.18, 'BTC KLBN11 | IRRF: R$3,18 | Extrato XP JUL/2026'],
  ['2026-07-22', 'BBDC4',  'outro',   1.39, -0.31, 'BTC BBDC4 | IRRF: R$0,31 | Extrato XP JUL/2026'],
  ['2026-07-23', 'VALE3',  'outro',   2.71, -0.60, 'BTC VALE3 | IRRF: R$0,60 | Extrato XP JUL/2026'],
  ['2026-07-23', 'CYRE3',  'outro',   2.71, -0.60, 'BTC CYRE3 | IRRF: R$0,60 | Extrato XP JUL/2026'],
  ['2026-07-23', 'BBAS3',  'outro',   0.34, -0.07, 'BTC BBAS3 | IRRF: R$0,07 | Extrato XP JUL/2026'],
  ['2026-07-23', 'AURE3',  'outro',   0.19, -0.04, 'BTC AURE3 | IRRF: R$0,04 | Extrato XP JUL/2026'],
  ['2026-07-24', 'BPAC11', 'outro',   0.84, -0.18, 'BTC BPAC11 | IRRF: R$0,18 | Extrato XP JUL/2026'],
  ['2026-07-27', 'TTEN3',  'outro',   1.87, -0.42, 'BTC TTEN3 | IRRF: R$0,42 | Extrato XP JUL/2026'],
  ['2026-07-29', 'MBRF3',  'outro', 298.30,-67.10, 'BTC MBRF3 | IRRF: R$67,10 | Extrato XP JUL/2026'],
  ['2026-07-29', 'CMIN3',  'outro', 814.61,-183.28,'BTC CMIN3 | IRRF: R$183,28 | Extrato XP JUL/2026'],
  ['2026-07-30', 'CYRE3',  'outro',   2.31, -0.51, 'BTC CYRE3 | IRRF: R$0,51 | Extrato XP JUL/2026'],
  ['2026-07-31', 'BRAV3',  'outro',  22.64, -5.09, 'BTC BRAV3 | IRRF: R$5,09 | Extrato XP JUL/2026'],
];

let inserted = 0;
let totalBruto = 0;
let totalIRRF = 0;

for (const [data, ticker, tipo, valorBruto, irrf, notas] of proventos) {
  const assetId = TICKER_MAP[ticker];
  if (!assetId) {
    console.warn(`⚠️  Ticker ${ticker} não encontrado no mapa — pulando`);
    continue;
  }

  // Registrar o valor bruto na tabela dividends
  // Para BTC: registrar bruto e incluir IRRF nas notas
  const notasCompletas = irrf < 0
    ? `${notas} | Líquido: R$${(valorBruto + irrf).toFixed(2)}`
    : notas;

  await conn.execute(
    `INSERT INTO dividends (userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, NOW())`,
    [
      USER_ID,
      assetId,
      tipo,
      valorBruto.toFixed(8), // valuePerShare = totalValue (não temos valor por ação separado)
      1,                      // quantity = 1 (total já calculado)
      valorBruto.toFixed(2),
      new Date(data),         // exDate
      new Date(data),         // paymentDate = mesma data
      notasCompletas,
    ]
  );

  inserted++;
  totalBruto += valorBruto;
  totalIRRF += irrf;
  console.log(`✅ ${data} | ${ticker} | ${tipo} | R$ ${valorBruto.toFixed(2)}`);
}

console.log(`\n=== RESUMO ===`);
console.log(`Lançamentos inseridos: ${inserted}`);
console.log(`Total bruto:   R$ ${totalBruto.toFixed(2)}`);
console.log(`Total IRRF:    R$ ${totalIRRF.toFixed(2)}`);
console.log(`Total líquido: R$ ${(totalBruto + totalIRRF).toFixed(2)}`);

await conn.end();
