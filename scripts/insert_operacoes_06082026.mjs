/**
 * Script para inserir as operações do dia 06/08/2026
 *
 * COMPRAS EUA (USD) — XP Internacional:
 *   INDA  | compra | 7,69220 cotas  | US$ 50,26/cota | total US$ 388,09 | corretagem US$ 1,50
 *   INDA  | compra | 40,00000 cotas | US$ 50,25/cota | total US$ 2.018,60 | corretagem US$ 8,60
 *   URNM  | compra | 12,00000 cotas | US$ 53,33/cota | total US$ 641,46  | corretagem US$ 1,50
 *
 * RENDA FIXA (BRL) — XP:
 *   Tesouro Selic 2031 | compra | 0,90 títulos | R$ 17.590,19 total | liquidação 06/08/2026
 *   CDB Banco XP S.A. AGO/2028 | aplicação | 7.000 cotas | R$ 7.000,00 | 100% CDI | venc. 05/08/2028
 *
 * VENDA (BRL) — Nota de corretagem XP nº 141490300 (05/08/2026):
 *   BRAVA3 (BRAV3) | venda leilão | 1.009 cotas | R$ 23,00/cota | total R$ 23.207,00
 *   Custos/despesas: R$ 166,23 | Líquido: R$ 23.201,83 C (liquidação 17/08/2026)
 *   IRRF s/ operações: R$ 1,16 | Emolumentos: R$ 1,16 | Taxa operacional: R$ 141,25
 *
 * Mapeamento assetId:
 *   INDA  → 80 | URNM → 78 | BRAV3 → 10 | SELIC_31 → 69
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const USER_ID = 1;
const DATE_06 = new Date('2026-08-06T11:55:00-03:00');
const DATE_05 = new Date('2026-08-05T14:09:00-03:00'); // nota de corretagem emitida em 05/08

// Verificar/criar CDB XP 2028 como ativo
const [cdbCheck] = await conn.execute("SELECT id FROM assets WHERE ticker = 'CDB_XP_2028'");
let cdbAssetId;
if (cdbCheck.length === 0) {
  console.log('Criando ativo CDB_XP_2028...');
  const [result] = await conn.execute(
    `INSERT INTO assets (userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice, createdAt, updatedAt)
     VALUES (?, 'CDB_XP_2028', 'CDB Banco XP S.A. - AGO/2028 (100% CDI)', 'renda_fixa', 'BRL', 0, 1, 0, 1, NOW(), NOW())`,
    [USER_ID]
  );
  cdbAssetId = result.insertId;
  console.log(`CDB criado com id: ${cdbAssetId}`);
} else {
  cdbAssetId = cdbCheck[0].id;
  console.log(`CDB já existe com id: ${cdbAssetId}`);
}

// [assetId, tipo, quantidade, precoUnitario, totalValue, fees, moeda, notas]
const operacoes = [
  // === EUA (USD) ===
  [80, 'buy',  7.69220, 50.26,   388.09, 1.50, 'USD', 'Compra INDA a mercado | XP Internacional | 06/08/2026'],
  [80, 'buy', 40.00000, 50.25,  2018.60, 8.60, 'USD', 'Compra INDA a mercado (lote) | XP Internacional | 06/08/2026'],
  [78, 'buy', 12.00000, 53.33,   641.46, 1.50, 'USD', 'Compra URNM a mercado | XP Internacional | 06/08/2026'],

  // === RENDA FIXA (BRL) ===
  [69, 'buy',  0.90, 19544.6556, 17590.19, 0, 'BRL', 'Compra Tesouro Selic 2031 | 0,90 títulos | XP | 06/08/2026 | liquidação 06/08/2026'],
  [cdbAssetId, 'buy', 7000, 1.00, 7000.00, 0, 'BRL', 'Aplicação CDB Banco XP S.A. AGO/2028 | 100% CDI | venc. 05/08/2028 | XP | 06/08/2026'],

  // === VENDA (BRL) — Nota nº 141490300 ===
  [10, 'sell', 1009, 23.00, 23207.00, 166.23, 'BRL', 'Venda BRAV3 leilão | 1.009 cotas @ R$23,00 | Nota 141490300 | XP | 05/08/2026 | liq. 17/08/2026 | IRRF R$1,16'],
];

let inserted = 0;
let totalComprasBRL = 0, totalVendasBRL = 0, totalComprasUSD = 0;

for (const [assetId, tipo, qty, preco, total, fees, moeda, notas] of operacoes) {
  const date = notas.includes('05/08/2026') ? DATE_05 : DATE_06;
  await conn.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [USER_ID, assetId, tipo, qty.toFixed(8), preco.toFixed(8), total.toFixed(2), fees.toFixed(2), date, notas]
  );
  inserted++;
  const sign = tipo === 'buy' ? '+' : '-';
  console.log(`${sign} ${tipo.toUpperCase()} | assetId:${assetId} | ${qty} x ${moeda} ${preco} = ${moeda} ${total.toFixed(2)} | fees: ${fees} | ${notas.split('|')[0].trim()}`);

  if (moeda === 'BRL') {
    if (tipo === 'buy') totalComprasBRL += total;
    else totalVendasBRL += total;
  } else {
    if (tipo === 'buy') totalComprasUSD += total;
  }
}

console.log(`\n=== RESUMO 06/08/2026 ===`);
console.log(`Lançamentos inseridos: ${inserted}`);
console.log(`Compras BRL:   R$ ${totalComprasBRL.toFixed(2)}`);
console.log(`Vendas BRL:    R$ ${totalVendasBRL.toFixed(2)}`);
console.log(`Saldo BRL:     R$ ${(totalVendasBRL - totalComprasBRL).toFixed(2)}`);
console.log(`Compras USD:   US$ ${totalComprasUSD.toFixed(2)}`);

await conn.end();
