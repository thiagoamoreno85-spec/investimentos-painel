import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export interface ParsedDividend {
  ticker: string;
  type: "dividendo" | "jcp" | "rendimento" | "amortizacao";
  paymentDate: Date;
  quantity: number;
  totalValue: number;
  valuePerShare: number;
}

/**
 * Extrai proventos de um PDF da XP Investimentos
 * Procura pela seção "Proventos" e mapeia os dados
 * 
 * Formato esperado do pdftotext:
 * Proventos
 * 0.31% | Ações
 * Ativo    Indexador    Data Provisão Pagamento    Quantidade Provisionada    Provisionado
 * BBDC4    JURO    01/06/2026    1042    R$ 19,77
 * BBDC4    JUROS SOBRE CAPITAL PROPRIO    31/07/2026    10    R$ 3,86
 */
export function parseXPDividendsPDFText(pdfText: string): ParsedDividend[] {
  const proventosMatch = pdfText.match(/Proventos[\s\S]*?(?=PRÓXIMOS|DISTRIBUIÇÃO|$)/i);
  if (!proventosMatch) return [];

  const lines = proventosMatch[0]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex(
    (line) => line.includes("Ativo") && line.includes("Indexador")
  );
  if (headerIndex === -1) return [];

  const dividends: ParsedDividend[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (/^[A-Z\s]+$/.test(line) || /PRÓXIMOS|DISTRIBUIÇÃO/i.test(line)) break;
    const match = line.match(
      /^([A-Z0-9]{4,8})\s{2,}(.+?)\s{2,}(\d{2}\/\d{2}\/\d{4})\s{2,}([\d.,]+)\s{2,}R\$\s*([\d.,]+)/
    );
    if (!match) continue;

    const [, ticker, typeRaw, dateStr, quantityRaw, valueRaw] = match;
    const [day, month, year] = dateStr.split("/").map(Number);
    const paymentDate = new Date(year, month - 1, day);
    const quantity = Number(quantityRaw.replace(/\./g, "").replace(",", "."));
    const totalValue = Number(valueRaw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(paymentDate.getTime()) || quantity <= 0 || totalValue <= 0) continue;

    const normalizedType = typeRaw.toUpperCase();
    const type = normalizedType.includes("JURO")
      ? "jcp"
      : normalizedType.includes("RENDIMENTO")
        ? "rendimento"
        : normalizedType.includes("AMORTIZA")
          ? "amortizacao"
          : "dividendo";

    dividends.push({ ticker, type, paymentDate, quantity, totalValue, valuePerShare: totalValue / quantity });
  }

  return dividends;
}

export async function parseXPDividendsPDFBuffer(buffer: Buffer): Promise<ParsedDividend[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return parseXPDividendsPDFText(parsed.text);
  } finally {
    await parser.destroy();
  }
}

export async function parseXPDividendsPDF(pdfPath: string): Promise<ParsedDividend[]> {
  return parseXPDividendsPDFBuffer(await readFile(pdfPath));
}

/**
 * Deduplicar dividendos por (ticker, type, paymentDate)
 */
export function deduplicateDividends(
  dividends: ParsedDividend[]
): ParsedDividend[] {
  const seen = new Set<string>();
  const result: ParsedDividend[] = [];

  for (const div of dividends) {
    const key = `${div.ticker}|${div.type}|${div.paymentDate.toISOString().split("T")[0]}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(div);
    }
  }

  return result;
}
