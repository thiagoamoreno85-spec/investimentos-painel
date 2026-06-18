import { parse } from 'csv-parse/sync';

export type ParsedTransaction = {
  ticker: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalCost: number;
  date: string; // "YYYY-MM-DD"
  assetClass: string;
};

// Detecta automaticamente o formato da corretora pelo cabeçalho
export function detectFormat(headers: string[]): 'xp' | 'rico' | 'clear' | 'b3' | 'unknown' {
  const h = headers.map(s => s.toLowerCase().trim());
  if (h.includes('negociação') && h.includes('c/v')) return 'b3';
  if (h.includes('ativo') && h.includes('operação')) return 'xp';
  if (h.includes('papel') && h.includes('tipo operação')) return 'rico';
  if (h.includes('código') && h.includes('natureza')) return 'clear';
  return 'unknown';
}

// Inferir classe de ativo pelo ticker
function inferAssetClass(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.endsWith('11')) return 'fundos'; // FII
  if (t.endsWith('F')) return 'rv_nacional';  // Fracionário
  if (/^[A-Z]{4}[0-9]$/.test(t)) return 'rv_nacional'; // Ação BR padrão
  if (['BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'MATIC'].includes(t)) return 'cripto';
  if (['URNM', 'URA', 'CCJ'].includes(t)) return 'uranio';
  if (t.includes('CDB') || t.includes('LCI') || t.includes('LCA') || t.includes('CRI') || t.includes('CRA')) return 'renda_fixa';
  return 'rv_eua'; // fallback para tickers US
}

// Parser formato B3 (extrato de negociação)
function parseB3(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => {
    const ticker = (row['Código de Negociação'] || row['codigo'] || '').trim().replace(/F$/, '');
    const type: 'buy' | 'sell' = (row['C/V'] || row['cv'] || '').trim().toUpperCase() === 'C' ? 'buy' : 'sell';
    const quantity = parseFloat((row['Quantidade'] || '0').replace('.', '').replace(',', '.'));
    const price = parseFloat((row['Preço'] || '0').replace('.', '').replace(',', '.'));
    const rawDate = row['Data do Negócio'] || row['data'] || '';
    const [d, m, y] = rawDate.split('/');
    return {
      ticker,
      type,
      quantity,
      price,
      totalCost: quantity * price,
      date: `${y}-${m}-${d}`,
      assetClass: inferAssetClass(ticker),
    };
  }).filter(t => t.ticker && t.quantity > 0);
}

// Parser formato XP
function parseXP(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => {
    const ticker = (row['Ativo'] || '').trim();
    const type: 'buy' | 'sell' = (row['Operação'] || '').toLowerCase().includes('compra') ? 'buy' : 'sell';
    const quantity = parseFloat((row['Quantidade'] || '0').replace('.', '').replace(',', '.'));
    const price = parseFloat((row['Preço'] || '0').replace('R$', '').replace('.', '').replace(',', '.').trim());
    const rawDate = row['Data'] || '';
    const [d, m, y] = rawDate.split('/');
    return {
      ticker,
      type,
      quantity,
      price,
      totalCost: quantity * price,
      date: `${y}-${m}-${d}`,
      assetClass: inferAssetClass(ticker),
    };
  }).filter(t => t.ticker && t.quantity > 0);
}

// Parser formato Rico
function parseRico(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => {
    const ticker = (row['Papel'] || '').trim();
    const type: 'buy' | 'sell' = (row['Tipo Operação'] || '').toLowerCase().includes('compra') ? 'buy' : 'sell';
    const quantity = parseFloat((row['Qtde'] || '0').replace('.', '').replace(',', '.'));
    const price = parseFloat((row['Preço'] || '0').replace('.', '').replace(',', '.'));
    const rawDate = row['Data Negócio'] || '';
    const [d, m, y] = rawDate.split('/');
    return {
      ticker,
      type,
      quantity,
      price,
      totalCost: quantity * price,
      date: `${y}-${m}-${d}`,
      assetClass: inferAssetClass(ticker),
    };
  }).filter(t => t.ticker && t.quantity > 0);
}

// Parser formato Clear
function parseClear(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => {
    const ticker = (row['Código'] || '').trim();
    const typeStr = (row['Natureza'] || '').toLowerCase();
    const type: 'buy' | 'sell' = typeStr.includes('compra') ? 'buy' : 'sell';
    const quantity = parseFloat((row['Quantidade'] || '0').replace('.', '').replace(',', '.'));
    const price = parseFloat((row['Preço'] || '0').replace('.', '').replace(',', '.'));
    const rawDate = row['Data Negociação'] || '';
    const [d, m, y] = rawDate.split('/');
    return {
      ticker,
      type,
      quantity,
      price,
      totalCost: quantity * price,
      date: `${y}-${m}-${d}`,
      assetClass: inferAssetClass(ticker),
    };
  }).filter(t => t.ticker && t.quantity > 0);
}

export function parseCSV(csvContent: string): { transactions: ParsedTransaction[]; format: string; total: number } {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (records.length === 0) return { transactions: [], format: 'unknown', total: 0 };

  const headers = Object.keys(records[0]);
  const format = detectFormat(headers);

  let transactions: ParsedTransaction[] = [];
  if (format === 'b3') transactions = parseB3(records);
  else if (format === 'xp') transactions = parseXP(records);
  else if (format === 'rico') transactions = parseRico(records);
  else if (format === 'clear') transactions = parseClear(records);

  return { transactions, format, total: transactions.length };
}
