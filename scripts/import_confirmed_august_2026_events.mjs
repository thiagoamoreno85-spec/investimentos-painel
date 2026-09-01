import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const USER_ID = 1;
const SOURCE_PATH = '/home/ubuntu/investimentos-painel/.tmp_statement_aug2026_classified.json';
const SOURCE_TAG = 'Extrato XP AGO/2026';

const tickerAliases = [
  ['TTEN', 'TTEN3'],
  ['MBRF', 'MBRF3'],
  ['BBDC', 'BBDC4'],
  ['BPAC', 'BPAC11'],
  ['BRAV', 'BRAV3'],
  ['CMIN', 'CMIN3'],
  ['CXSE', 'CXSE3'],
  ['FLRY', 'FLRY3'],
  ['KLBN', 'KLBN11'],
  ['SBSP', 'SBSP3'],
  ['SUZB', 'SUZB3'],
  ['AURE', 'AURE3'],
  ['VALE', 'VALE3'],
  ['XPML', 'XPML11'],
  ['ZAVI', 'ZAVI11'],
];

function resolveTicker(event) {
  const description = event.description.toUpperCase();
  if (description.includes('CYRE')) {
    if (event.movement_date === '2026-08-20') return 'CYRE4';
    return 'CYRE3';
  }
  for (const [alias, ticker] of tickerAliases) {
    if (description.includes(alias)) return ticker;
  }
  return null;
}

function toDate(dateText) {
  return new Date(`${dateText}T12:00:00.000Z`);
}

const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [assetRows] = await connection.execute(
    `SELECT id, ticker FROM assets WHERE userId = ?`,
    [USER_ID],
  );
  const assetIdByTicker = new Map(assetRows.map((asset) => [asset.ticker, asset.id]));

  let dividendInserted = 0;
  let dividendSkipped = 0;
  let cashInserted = 0;
  let cashSkipped = 0;

  const grossRentalEvents = source.events.filter((event) => event.category === 'aluguel_acoes_bruto');
  const fiiEvents = source.events.filter((event) => event.category === 'provento_fii');

  const dividendEvents = [
    ...grossRentalEvents.map((event) => ({
      ...event,
      ticker: resolveTicker(event),
      type: 'outro',
      label: 'Aluguel de ações (BTC)',
    })),
    ...fiiEvents.map((event) => ({
      ...event,
      ticker: resolveTicker(event),
      type: 'rendimento',
      label: 'Rendimento de FII',
    })),
  ];

  for (const event of dividendEvents) {
    const assetId = assetIdByTicker.get(event.ticker);
    if (!assetId) {
      throw new Error(`Ativo não encontrado para o lançamento da linha ${event.row}: ${event.description}`);
    }

    const sourceKey = `${SOURCE_TAG} | linha ${event.row}`;
    const [existing] = await connection.execute(
      `SELECT id FROM dividends WHERE userId = ? AND notes LIKE ? LIMIT 1`,
      [USER_ID, `%${sourceKey}%`],
    );
    if (existing.length > 0) {
      dividendSkipped += 1;
      continue;
    }

    const relatedCharges = source.events.filter((candidate) =>
      candidate.category !== 'aluguel_acoes_bruto'
      && candidate.movement_date === event.movement_date
      && resolveTicker(candidate) === event.ticker
      && (candidate.category.startsWith('aluguel_acoes') || candidate.category === 'ajuste_custo_aluguel'),
    );
    const relatedSummary = relatedCharges
      .map((charge) => `${charge.description}: R$ ${charge.value_brl.toFixed(2)}`)
      .join(' | ');
    const netReference = event.value_brl + relatedCharges.reduce((total, charge) => total + charge.value_brl, 0);
    const notes = `${event.label} | ${event.description} | Bruto: R$ ${event.value_brl.toFixed(2)} | Líquido de referência: R$ ${netReference.toFixed(2)}${relatedSummary ? ` | Encargos: ${relatedSummary}` : ''} | ${sourceKey}`;

    await connection.execute(
      `INSERT INTO dividends
        (userId, assetId, type, valuePerShare, quantity, totalValue, currency, exDate, paymentDate, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, NOW())`,
      [
        USER_ID,
        assetId,
        event.type,
        event.value_brl.toFixed(8),
        '1.00000000',
        event.value_brl.toFixed(2),
        toDate(event.movement_date),
        toDate(event.settlement_date ?? event.movement_date),
        notes,
      ],
    );
    dividendInserted += 1;
  }

  const cashEvents = [
    ...source.events
      .filter((event) => event.category === 'aporte_conta_digital' && event.value_brl === 6000)
      .map((event) => ({
        ...event,
        type: 'entrada',
        category: 'aporte_externo',
        label: 'Aporte externo — transferência da conta digital',
      })),
    ...source.events
      .filter((event) => event.category === 'reembolso_evento_corporativo')
      .map((event) => ({
        ...event,
        type: 'entrada',
        category: 'outro',
        label: 'Reembolso de evento corporativo',
      })),
  ];

  for (const event of cashEvents) {
    const sourceKey = `${SOURCE_TAG} | linha ${event.row}`;
    const [existing] = await connection.execute(
      `SELECT id FROM cash_movements WHERE userId = ? AND description LIKE ? LIMIT 1`,
      [USER_ID, `%${sourceKey}%`],
    );
    if (existing.length > 0) {
      cashSkipped += 1;
      continue;
    }

    await connection.execute(
      `INSERT INTO cash_movements (userId, type, category, amount, description, date, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        USER_ID,
        event.type,
        event.category,
        event.value_brl.toFixed(2),
        `${event.label} | ${event.description} | ${sourceKey} | Registro histórico: não altera o saldo atual de caixa.`,
        toDate(event.movement_date),
      ],
    );
    cashInserted += 1;
  }

  console.log(JSON.stringify({
    dividendInserted,
    dividendSkipped,
    cashInserted,
    cashSkipped,
    grossRentalTotal: grossRentalEvents.reduce((total, event) => total + event.value_brl, 0).toFixed(2),
    fiiIncomeTotal: fiiEvents.reduce((total, event) => total + event.value_brl, 0).toFixed(2),
    externalDepositTotal: cashEvents
      .filter((event) => event.category === 'aporte_externo')
      .reduce((total, event) => total + event.value_brl, 0)
      .toFixed(2),
    reimbursementTotal: cashEvents
      .filter((event) => event.category === 'outro')
      .reduce((total, event) => total + event.value_brl, 0)
      .toFixed(2),
  }, null, 2));
} finally {
  await connection.end();
}
