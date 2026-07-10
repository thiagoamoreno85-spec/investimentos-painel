/**
 * Parser de extrato XLSX da XP Investimentos
 * Extrai proventos (dividendos, JCP, rendimentos de FII) do extrato de conta corrente.
 *
 * Padrões identificados no extrato:
 *  - "CREDITO DE REEMBOLSO DE EVENTO   BR{ISIN}" → Dividendo ou JCP
 *  - "RENDIMENTOS DE CLIENTES {TICKER} S/ ..." → Rendimento de FII
 *
 * Mapeamento ISIN → ticker:
 *  Os primeiros 4 caracteres após "BR" no código ISIN geralmente correspondem ao ticker base.
 */

import * as XLSX from "xlsx";

export interface ParsedProvento {
  ticker: string;
  type: "dividendo" | "jcp" | "rendimento" | "outro";
  totalValue: number;
  paymentDate: Date;
  description: string;
  isinCode?: string;
}

/** Mapeamento de prefixo ISIN (4 chars após BR) → ticker completo */
const ISIN_TO_TICKER: Record<string, string> = {
  BBDC: "BBDC4",
  BBAS: "BBAS3",
  SBSP: "SBSP3",
  VALE: "VALE3",
  CMIN: "CMIN3",
  MBRF: "MBRF3",
  BPAC: "BPAC11",
  ITUB: "ITUB4",
  PETR: "PETR4",
  WEGE: "WEGE3",
  TAEE: "TAEE11",
  TRPL: "TRPL4",
  CMIG: "CMIG4",
  ENGI: "ENGI11",
  SAPR: "SAPR11",
  EGIE: "EGIE3",
  KLBN: "KLBN11",
  SUZB: "SUZB3",
  BBSE: "BBSE3",
  SULA: "SULA11",
  PSSA: "PSSA3",
  CXSE: "CXSE3",
  RDOR: "RDOR3",
  HYPE: "HYPE3",
  FLRY: "FLRY3",
  BRSR: "BRSR6",
  SANB: "SANB11",
  TIMS: "TIMS3",
  VIVT: "VIVT3",
  CPFE: "CPFE3",
  NEOE: "NEOE3",
  AURE: "AURE3",
  CSNA: "CSNA3",
  USIM: "USIM5",
  GGBR: "GGBR4",
  GOAU: "GOAU4",
  JBSS: "JBSS3",
  MRFG: "MRFG3",
  BEEF: "BEEF3",
  BRFS: "BRFS3",
  ABEV: "ABEV3",
  RAPT: "RAPT4",
  TUPY: "TUPY3",
  EMAE: "EMAE4",
  COGN: "COGN3",
  YDUQ: "YDUQ3",
  RENT: "RENT3",
  CIEL: "CIEL3",
  JHSF: "JHSF3",
  MRVE: "MRVE3",
  CYRE: "CYRE3",
  EZTC: "EZTC3",
  TEND: "TEND3",
  EVEN: "EVEN3",
  GFSA: "GFSA3",
  TRIS: "TRIS3",
  RLOG: "RLOG3",
  VAMO: "VAMO3",
  SIMH: "SIMH3",
  RAIL: "RAIL3",
  CCRO: "CCRO3",
  ECOR: "ECOR3",
  AZUL: "AZUL4",
  GOLL: "GOLL4",
  EMBR: "EMBR3",
  TGMA: "TGMA3",
  DXCO: "DXCO3",
  LOGG: "LOGG3",
  BRML: "BRML3",
  MULT: "MULT3",
  IGTI: "IGTI11",
  ALLO: "ALLOS3",
  BRPR: "BRPR3",
  BRCR: "BRCR11",
  HGLG: "HGLG11",
  HGRE: "HGRE11",
  HGBS: "HGBS11",
  HGRU: "HGRU11",
  KNRI: "KNRI11",
  KNCR: "KNCR11",
  KNIP: "KNIP11",
  MXRF: "MXRF11",
  XPML: "XPML11",
  BCFF: "BCFF11",
  ORVR: "ORVR3",
  BRAV: "BRAV3",
  TTEN: "TTEN3",
  AXIA: "AXIA3",
  RECV: "RECV3",
  RRRP: "RRRP3",
  PRIO: "PRIO3",
  UGPA: "UGPA3",
  VBBR: "VBBR3",
  CSAN: "CSAN3",
  RAIZ: "RAIZ4",
  SMTO: "SMTO3",
  SLCE: "SLCE3",
  AGRO: "AGRO3",
  ARZZ: "ARZZ3",
  SOMA: "SOMA3",
  VIVA: "VIVA3",
  LREN: "LREN3",
  PCAR: "PCAR3",
  ASAI: "ASAI3",
  CRFB: "CRFB3",
  MDIA: "MDIA3",
  BRAP: "BRAP4",
  CBAV: "CBAV3",
  IRBR: "IRBR3",
  ODPV: "ODPV3",
  HAPV: "HAPV3",
  POSI: "POSI3",
  TOTS: "TOTS3",
  LWSA: "LWSA3",
  CASH: "CASH3",
  STNE: "STNE",
  REDE: "REDE3",
  TPIS: "TPIS3",
  PLPL: "PLPL3",
  LAVV: "LAVV3",
  HBOR: "HBOR3",
  VSTE: "VSTE3",
  VVEO: "VVEO3",
  MOVI: "MOVI3",
  LCAM: "LCAM3",
  MLAS: "MLAS3",
  DIRR: "DIRR3",
  ANIM: "ANIM3",
  SEER: "SEER3",
  SMFT: "SMFT3",
  CEAB: "CEAB3",
  ALPA: "ALPA4",
  GREN: "GRENDENE3",
  ILOS: "ILOS3",
  ZAVI: "ZAVI11",
};

/**
 * Determina o tipo de provento com base na descrição
 */
function inferType(description: string): "dividendo" | "jcp" | "rendimento" | "outro" {
  const upper = description.toUpperCase();
  if (upper.includes("JCP") || upper.includes("JUROS SOBRE CAPITAL")) return "jcp";
  if (upper.includes("RENDIMENTO")) return "rendimento";
  if (upper.includes("CREDITO DE REEMBOLSO") || upper.includes("DIVIDENDO")) return "dividendo";
  return "outro";
}

/**
 * Extrai o ticker a partir do código ISIN no final da descrição "CREDITO DE REEMBOLSO DE EVENTO"
 * Formato: BRXXXXACNORX ou BRXXXXACNPRX
 */
function extractTickerFromISIN(description: string): { ticker: string; isin: string } | null {
  const parts = description.trim().split(/\s+/);
  const isin = parts[parts.length - 1];
  if (!isin || !isin.startsWith("BR") || isin.length < 6) return null;
  const prefix = isin.substring(2, 6).toUpperCase();
  const ticker = ISIN_TO_TICKER[prefix] || `${prefix}?`;
  return { ticker, isin };
}

/**
 * Extrai o ticker de uma linha "RENDIMENTOS DE CLIENTES {TICKER} S/ ..."
 */
function extractTickerFromRendimento(description: string): string | null {
  const match = description.match(/RENDIMENTOS DE CLIENTES\s+([A-Z0-9]+)\s+/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Parseia o extrato XLSX da XP e retorna os proventos identificados.
 * Ignora lançamentos de BTC (aluguel), taxas e débitos.
 */
export function parseXPStatementXLSX(buffer: Buffer): ParsedProvento[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

  const proventos: ParsedProvento[] = [];

  const BTC_KEYWORDS = ["BTC", "TAXA DE INTERMEDIAÇÃO", "DEBITO CBLC IRRF", "OPERAÇÕES EM BOLSA"];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;

    // Colunas esperadas: [col0, data_mov, data_liq, descricao, col4, valor, saldo, ...]
    const rawDate = row[1];
    const descricao = typeof row[3] === "string" ? row[3].trim() : null;
    const rawValor = row[5];

    if (!descricao || rawValor === null || rawValor === undefined) continue;

    const valor = typeof rawValor === "number" ? rawValor : parseFloat(String(rawValor).replace(",", "."));
    if (isNaN(valor) || valor <= 0) continue; // Apenas créditos

    const descUpper = descricao.toUpperCase();

    // Ignorar BTC, taxas e operações de bolsa
    if (BTC_KEYWORDS.some((kw) => descUpper.includes(kw))) continue;

    // Identificar data
    let paymentDate: Date;
    if (rawDate instanceof Date) {
      paymentDate = rawDate;
    } else if (typeof rawDate === "string" && rawDate.match(/\d{4}-\d{2}-\d{2}/)) {
      paymentDate = new Date(rawDate);
    } else {
      continue;
    }

    // Caso 1: CREDITO DE REEMBOLSO DE EVENTO
    if (descUpper.includes("CREDITO DE REEMBOLSO DE EVENTO")) {
      const extracted = extractTickerFromISIN(descricao);
      if (!extracted) continue;
      proventos.push({
        ticker: extracted.ticker,
        type: inferType(descricao),
        totalValue: valor,
        paymentDate,
        description: descricao,
        isinCode: extracted.isin,
      });
      continue;
    }

    // Caso 2: RENDIMENTOS DE CLIENTES (FIIs)
    if (descUpper.includes("RENDIMENTOS DE CLIENTES")) {
      const ticker = extractTickerFromRendimento(descricao);
      if (!ticker) continue;
      proventos.push({
        ticker,
        type: "rendimento",
        totalValue: valor,
        paymentDate,
        description: descricao,
      });
      continue;
    }

    // Caso 3: Outras linhas com "DIVIDENDO" ou "JCP" explícito
    if (descUpper.includes("DIVIDENDO") || descUpper.includes("JCP") || descUpper.includes("JUROS SOBRE CAPITAL")) {
      // Tentar extrair ticker da descrição
      const tickerMatch = descricao.match(/([A-Z]{4}[0-9]{1,2})\b/);
      if (!tickerMatch) continue;
      proventos.push({
        ticker: tickerMatch[1],
        type: inferType(descricao),
        totalValue: valor,
        paymentDate,
        description: descricao,
      });
    }
  }

  return proventos;
}


/**
 * Interface para transações de caixa (aportes, saques, taxas)
 */
export interface ParsedCashTransaction {
  type: "aporte" | "saque" | "taxa" | "outro";
  description: string;
  amount: number; // Positivo para créditos, negativo para débitos
  transactionDate: Date;
}

/**
 * Interface para resumo do extrato
 */
export interface StatementSummary {
  startBalance: number;
  endBalance: number;
  totalAportes: number;
  totalSaques: number;
  totalTaxas: number;
  totalProventos: number;
}

/**
 * Extrai transações de caixa do extrato (aportes, saques, taxas)
 * Retorna array com todas as transações encontradas
 */
export function parseCashTransactions(buffer: Buffer): ParsedCashTransaction[] {
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

  const transactions: ParsedCashTransaction[] = [];

  // Palavras-chave para identificar tipos de transação
  const APORTE_KEYWORDS = ["TRANSFERÊNCIA", "DEPÓSITO", "TED", "DOC", "PIX"];
  const SAQUE_KEYWORDS = ["SAQUE", "TRANSFERÊNCIA ENVIADA", "RESGATE"];
  const TAXA_KEYWORDS = ["TAXA", "CORRETAGEM", "EMOLUMENTO", "IRRF", "IOF"];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;

    const rawDate = row[1];
    const descricao = typeof row[3] === "string" ? row[3].trim() : null;
    const rawValor = row[5];

    if (!descricao || rawValor === null || rawValor === undefined) continue;

    const valor = typeof rawValor === "number" ? rawValor : parseFloat(String(rawValor).replace(",", "."));
    if (isNaN(valor)) continue;

    // Identificar data
    let transactionDate: Date;
    if (rawDate instanceof Date) {
      transactionDate = rawDate;
    } else if (typeof rawDate === "string" && rawDate.match(/\d{4}-\d{2}-\d{2}/)) {
      transactionDate = new Date(rawDate);
    } else {
      continue;
    }

    const descUpper = descricao.toUpperCase();

    // Ignorar proventos (já são tratados por parseProventos)
    if (descUpper.includes("CREDITO DE REEMBOLSO DE EVENTO") || descUpper.includes("RENDIMENTOS DE CLIENTES")) {
      continue;
    }

    // Classificar transação
    if (APORTE_KEYWORDS.some((kw) => descUpper.includes(kw)) && valor > 0) {
      transactions.push({
        type: "aporte",
        description: descricao,
        amount: valor,
        transactionDate,
      });
    } else if (SAQUE_KEYWORDS.some((kw) => descUpper.includes(kw))) {
      transactions.push({
        type: "saque",
        description: descricao,
        amount: -Math.abs(valor),
        transactionDate,
      });
    } else if (TAXA_KEYWORDS.some((kw) => descUpper.includes(kw))) {
      transactions.push({
        type: "taxa",
        description: descricao,
        amount: -Math.abs(valor),
        transactionDate,
      });
    }
  }

  return transactions;
}

/**
 * Extrai saldo inicial e final do extrato
 */
export function extractStatementBalances(buffer: Buffer): { startBalance: number; endBalance: number } {
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

  let startBalance = 0;
  let endBalance = 0;

  // Primeira linha com valor de saldo é o saldo inicial
  // Última linha com valor de saldo é o saldo final
  const saldoRows = rows.filter((row) => {
    if (!Array.isArray(row) || row.length < 7) return false;
    const saldo = row[6];
    return saldo !== null && saldo !== undefined && !isNaN(parseFloat(String(saldo).replace(",", ".")));
  });

  if (saldoRows.length > 0) {
    startBalance = parseFloat(String(saldoRows[0][6]).replace(",", "."));
    endBalance = parseFloat(String(saldoRows[saldoRows.length - 1][6]).replace(",", "."));
  }

  return { startBalance, endBalance };
}
