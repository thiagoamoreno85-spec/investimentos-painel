/**
 * Script para registrar:
 * 1. Vencimento do CDB BMG AGO/2026 (CDB32076NW3)
 *    - Bruto: R$ 1.181,74 | IR retido: R$ 45,64 | Líquido: R$ 1.136,10
 *    - Data: 04/08/2026
 *    - Ativo estava na planilha do Dr. Thiago mas conta era do Felipe
 *
 * 2. Transferência PIX recebida de Felipe de Aguirre Moreno
 *    - Valor: R$ 1.136,10 | Data: 04/08/2026 às 20h05
 *    - ID transação: E332646682026080423054919 07b0be8
 *    - Conta origem: XP 492095 (Felipe) → XP 496056 (Thiago)
 *
 * Estratégia:
 * - Criar o ativo CDB32076NW3 (se não existir) e registrar a venda/resgate na tabela transactions
 * - Registrar o provento (rendimento) na tabela dividends
 * - Registrar a entrada de caixa (PIX do Felipe) na tabela cash_movements
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const USER_ID = 1;
const DATE_04 = new Date('2026-08-04T20:05:00-03:00');

// 1. Criar o ativo CDB BMG se não existir
const [cdbCheck] = await conn.execute("SELECT id, totalQuantity, averageCost, totalCost FROM assets WHERE ticker = 'CDB32076NW3'");
let cdbAssetId;
if (cdbCheck.length === 0) {
  console.log('Criando ativo CDB32076NW3 (CDB BMG AGO/2026)...');
  // Valor original estimado: R$ 1.136,10 líquido / 0,9614 ≈ R$ 1.181,74 bruto
  // Custo original: aproximado pelo valor bruto de vencimento
  const [result] = await conn.execute(
    `INSERT INTO assets (userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost, lastPrice, createdAt, updatedAt)
     VALUES (?, 'CDB32076NW3', 'CDB Banco BMG S.A. - AGO/2026', 'renda_fixa', 'BRL', 1, 1181.74, 1181.74, 1181.74, NOW(), NOW())`,
    [USER_ID]
  );
  cdbAssetId = result.insertId;
  console.log(`CDB BMG criado com id: ${cdbAssetId}`);
} else {
  cdbAssetId = cdbCheck[0].id;
  console.log(`CDB BMG já existe com id: ${cdbAssetId} | qty: ${cdbCheck[0].totalQuantity} | avg: ${cdbCheck[0].averageCost}`);
}

// 2. Registrar o resgate/vencimento como transação de venda (valor bruto)
await conn.execute(
  `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes, createdAt)
   VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, NOW())`,
  [
    USER_ID,
    cdbAssetId,
    1,                    // quantidade: 1 título
    1181.74.toFixed(8),   // preço unitário bruto
    1181.74.toFixed(2),   // valor total bruto
    45.64.toFixed(2),     // IR retido como fee
    DATE_04,
    'Vencimento CDB32076NW3 | CDB BMG AGO/2026 | Bruto: R$1.181,74 | IR: R$45,64 | Líquido: R$1.136,10 | Conta Felipe (492095) → transferido para Thiago | 04/08/2026'
  ]
);
console.log('✅ Vencimento CDB BMG registrado como transação de venda');

// 3. Registrar o rendimento na tabela dividends
await conn.execute(
  `INSERT INTO dividends (userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes, createdAt)
   VALUES (?, ?, 'rendimento', ?, ?, ?, 'BRL', ?, ?, ?, NOW())`,
  [
    USER_ID,
    cdbAssetId,
    45.64.toFixed(8),   // rendimento por título (diferença entre bruto e custo original)
    1,
    45.64.toFixed(2),   // valor do rendimento (IR retido = 22,5% da base)
    DATE_04,
    DATE_04,
    'Rendimento CDB32076NW3 | CDB BMG AGO/2026 | Bruto: R$1.181,74 | IR retido: R$45,64 (22,5%) | Líquido: R$1.136,10 | 04/08/2026'
  ]
);
console.log('✅ Rendimento CDB BMG registrado em dividends');

// 4. Registrar a entrada de caixa (PIX do Felipe)
await conn.execute(
  `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
   VALUES (?, 'entrada', 'aporte_externo', ?, ?, ?, NOW())`,
  [
    USER_ID,
    1136.10.toFixed(2),
    'PIX recebido de Felipe de Aguirre Moreno (XP 492095) | Vencimento CDB BMG CDB32076NW3 repassado | R$1.136,10 líquido | ID: E332646682026080423054919 07b0be8 | 04/08/2026 20h05',
    DATE_04,
  ]
);
console.log('✅ Entrada de caixa (PIX Felipe) registrada em cash_movements');

console.log('\n=== RESUMO ===');
console.log('CDB BMG CDB32076NW3 vencido e baixado da carteira');
console.log('Bruto:  R$ 1.181,74');
console.log('IR:     R$ 45,64');
console.log('Líquido recebido via PIX: R$ 1.136,10');
console.log('Usado para compras de 06/08/2026');

await conn.end();
