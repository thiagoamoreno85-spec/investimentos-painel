import { extname } from "node:path";
import { parseXPDividendsPDFBuffer, type ParsedDividend } from "./pdfDividendParser";
import { parseXPStatementXLSX, type ParsedProvento } from "./xpStatementParser";

export type StatementFileType = "xlsx" | "pdf";

export type ParsedStatementProvento = Omit<ParsedProvento, "type"> & {
  type: "dividendo" | "jcp" | "rendimento" | "amortizacao" | "outro";
  quantity?: number;
  valuePerShare?: number;
  source: StatementFileType;
};

const MAX_STATEMENT_FILE_BYTES = 10 * 1024 * 1024;

export function detectStatementFileType(fileName: string): StatementFileType {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf") return "pdf";
  if (extension === ".xlsx" || extension === ".xls") return "xlsx";

  throw new Error("Formato não suportado. Envie um PDF, XLSX ou XLS.");
}

function fromPdfDividend(dividend: ParsedDividend): ParsedStatementProvento {
  return {
    ticker: dividend.ticker,
    type: dividend.type,
    totalValue: dividend.totalValue,
    paymentDate: dividend.paymentDate,
    description: "Provento extraído do extrato PDF da XP",
    quantity: dividend.quantity,
    valuePerShare: dividend.valuePerShare,
    source: "pdf",
  };
}

export async function parseXPStatementFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedStatementProvento[]> {
  if (buffer.length === 0) throw new Error("O arquivo está vazio.");
  if (buffer.length > MAX_STATEMENT_FILE_BYTES) {
    throw new Error("O arquivo excede o limite de 10 MB para importação.");
  }

  const source = detectStatementFileType(fileName);

  if (source === "xlsx") {
    return parseXPStatementXLSX(buffer).map((item) => ({ ...item, source }));
  }

  const dividends = await parseXPDividendsPDFBuffer(buffer);
  return dividends.map(fromPdfDividend);
}
