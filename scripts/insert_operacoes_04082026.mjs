/**
 * Script para inserir as operações do dia 04/08/2026
 * Fonte: screenshots das ordens executadas na XP Internacional e XP Brasil
 *
 * Operações identificadas:
 * --- EUA (USD) ---
 * INDA  | compra | 16,32031 cotas | US$ 50,42/cota | total US$ 824,33 | corretagem US$ 1,50
 * GOOGL | compra | 2,09814 cotas  | US$ 377,09/cota | total US$ 792,68 | corretagem US$ 1,50
 * URNM  | compra | 13,05107 cotas | US$ 52,45/cota | total US$ 686,04 | corretagem US$ 1,50
 *
 * --- BRASIL (BRL) ---
 * CMIN3F | venda  | 60 cotas   | R$ 5,73/cota  | total R$ 343,80  (fracionário)
 * CMIN3  | venda  | 3500 cotas | R$ 5,74/cota  | total R$ 20.090,00
 * KLBN11F| compra | 40 cotas   | R$ 18,24/cota | total R$ 729,60  (fracionário)
 * KLBN11 | compra | 100 cotas  | R$ 18,23/cota | total R$ 1.823,00
 * BBDC4F | compra | 40 cotas   | R$ 18,40/cota | total R$ 736,00  (fracionário)
 * BBDC4  | compra | 100 cotas  | R$ 18,38/cota | total R$ 1.838,00
 * CXSE3F | venda  | 90 cotas   | R$ 19,74/cota | total R$ 1.776,60 (fracionário)
 * CXSE3  | venda  | 500 cotas  | R$ 19,75/cota | total R$ 9.875,00
 * CMIN3  | compra | 600 cotas  | R$ 5,81/cota  | total R$ 3.486,00
 * CMIN3  | venda  | 600 cotas  | R$ 5,79/cota  | total R$ 3.474,00
 * SOJA3F | venda  | 3 cotas    | R$ 5,58/cota  | total R$ 16,74   (fracionário)
 * SOJA3  | venda  | 1500 cotas | R$ 5,58/cota  | total R$ 8.370,00
 *
 * Mapeamento assetId (verificado no banco):
 * CMIN3  → 3  | CXSE3 → 15 | BBDC4 → 16 | SOJA3 → 21
 * KLBN11 → 23 | GOOGL → 35 | INDA  → 80 | URNM  → 78
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const USER_ID = 1;
const DATE = new Date('2026-08-04T14:00:00-03:00'); // horário de Brasília

// Operações consolidadas por ativo (fracionário + lote agrupados)
// [assetId, tipo, quantidade, precoUnitario, totalValue, fees, moeda, notas]
const operacoes = [
  // === EUA (USD) ===
  [80, 'buy',  16.32031, 50.42,  824.33, 1.50, 'USD', 'Compra INDA a mercado | XP Internacional | 04/08/2026'],
  [35, 'buy',   2.09814, 377.09, 792.68, 1.50, 'USD', 'Compra GOOGL a mercado | XP Internacional | 04/08/2026'],
  [78, 'buy',  13.05107, 52.45,  686.04, 1.50, 'USD', 'Compra URNM a mercado | XP Internacional | 04/08/2026'],

  // === BRASIL (BRL) ===
  // CMIN3: venda 3560 total (3500 lote + 60 fracionário)
  [3,  'sell', 3500, 5.74, 20090.00, 0, 'BRL', 'Venda CMIN3 lote | XP | 04/08/2026 14h09'],
  [3,  'sell',   60, 5.73,   343.80, 0, 'BRL', 'Venda CMIN3F fracionário | XP | 04/08/2026 14h09'],

  // CMIN3: compra 600 e venda 600 (day trade)
  [3,  'buy',  600, 5.81, 3486.00, 0, 'BRL', 'Compra CMIN3 | XP | 04/08/2026 13h49'],
  [3,  'sell', 600, 5.79, 3474.00, 0, 'BRL', 'Venda CMIN3 | XP | 04/08/2026 13h48'],

  // KLBN11: compra 140 total (100 lote + 40 fracionário)
  [23, 'buy',  100, 18.23, 1823.00, 0, 'BRL', 'Compra KLBN11 lote | XP | 04/08/2026 14h04'],
  [23, 'buy',   40, 18.24,  729.60, 0, 'BRL', 'Compra KLBN11F fracionário | XP | 04/08/2026 14h04'],

  // BBDC4: compra 140 total (100 lote + 40 fracionário)
  [16, 'buy',  100, 18.38, 1838.00, 0, 'BRL', 'Compra BBDC4 lote | XP | 04/08/2026 14h00'],
  [16, 'buy',   40, 18.40,  736.00, 0, 'BRL', 'Compra BBDC4F fracionário | XP | 04/08/2026 14h00'],

  // CXSE3: venda 590 total (500 lote + 90 fracionário)
  [15, 'sell', 500, 19.75, 9875.00, 0, 'BRL', 'Venda CXSE3 lote | XP | 04/08/2026 13h50'],
  [15, 'sell',  90, 19.74, 1776.60, 0, 'BRL', 'Venda CXSE3F fracionário | XP | 04/08/2026 13h50'],

  // SOJA3: venda 1503 total (1500 lote + 3 fracionário)
  [21, 'sell', 1500, 5.58, 8370.00, 0, 'BRL', 'Venda SOJA3 lote | XP | 04/08/2026 13h46'],
  [21, 'sell',    3, 5.58,   16.74, 0, 'BRL', 'Venda SOJA3F fracionário | XP | 04/08/2026 13h46'],
];

let inserted = 0;
let totalComprasBRL = 0, totalVendasBRL = 0;
let totalComprasUSD = 0;

for (const [assetId, tipo, qty, preco, total, fees, moeda, notas] of operacoes) {
  await conn.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [USER_ID, assetId, tipo, qty.toFixed(8), preco.toFixed(8), total.toFixed(2), fees.toFixed(2), DATE, notas]
  );
  inserted++;
  const sign = tipo === 'buy' ? '+' : '-';
  console.log(`${sign} ${tipo.toUpperCase()} | assetId:${assetId} | ${qty} x ${preco} = ${moeda} ${total.toFixed(2)} | ${notas.split('|')[0].trim()}`);

  if (moeda === 'BRL') {
    if (tipo === 'buy') totalComprasBRL += total;
    else totalVendasBRL += total;
  } else {
    if (tipo === 'buy') totalComprasUSD += total;
  }
}

console.log(`\n=== RESUMO ===`);
console.log(`Lançamentos inseridos: ${inserted}`);
console.log(`Compras BRL:  R$ ${totalComprasBRL.toFixed(2)}`);
console.log(`Vendas BRL:   R$ ${totalVendasBRL.toFixed(2)}`);
console.log(`Saldo BRL:    R$ ${(totalVendasBRL - totalComprasBRL).toFixed(2)}`);
console.log(`Compras USD:  US$ ${totalComprasUSD.toFixed(2)}`);

await conn.end();
