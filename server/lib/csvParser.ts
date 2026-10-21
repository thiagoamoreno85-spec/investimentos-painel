import { parse } from "csv-parse/sync";

export type ParsedTransaction = {
  ticker: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  totalCost: number;
  fees: number;
  date: string;
  assetClass: string;
  sourceLine: number;
};

export type CsvValidationError = {
  line: number;
  field?: string;
  message: string;
};

export type ParseCsvResult = {
  transactions: ParsedTransaction[];
  format: "xp" | "rico" | "clear" | "b3" | "unknown";
  total: number;
  errors: CsvValidationError[];
};

type RawCsvTransaction = {
  ticker: string;
  operation: string;
  quantity: string;
  price: string;
  date: string;
};

export function detectFormat(headers: string[]): "xp" | "rico" | "clear" | "b3" | "unknown" {
  const h = headers.map((value) => value.toLowerCase().trim());
  if (h.includes("negociação") && h.includes("c/v")) return "b3";
  if (h.includes("ativo") && h.includes("operação")) return "xp";
  if (h.includes("papel") && h.includes("tipo operação")) return "rico";
  if (h.includes("código") && h.includes("natureza")) return "clear";
  return "unknown";
}

function inferAssetClass(ticker: string): string {
  const normalized = ticker.toUpperCase();
  if (normalized.endsWith("11")) return "fundos";
  if (normalized.endsWith("F")) return "rv_nacional";
  if (/^[A-Z]{4}[0-9]$/.test(normalized)) return "rv_nacional";
  if (["BTC", "ETH", "SOL", "AVAX", "ADA", "DOT", "MATIC"].includes(normalized)) return "cripto";
  if (["URNM", "URA", "CCJ"].includes(normalized)) return "uranio";
  if (normalized.includes("CDB") || normalized.includes("LCI") || normalized.includes("LCA") || normalized.includes("CRI") || normalized.includes("CRA")) return "renda_fixa";
  return "rv_eua";
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/F$/, "");
}

function parseBrazilianNumber(raw: string) {
  const value = raw.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!value) return Number.NaN;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(value)
      ? value.replace(/\./g, "")
      : value;
  return Number(normalized);
}

function parseBusinessDate(raw: string) {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const parts = iso ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) } : br
    ? { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) }
    : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() + 1 !== parts.month || date.getUTCDate() !== parts.day) return null;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseOperation(format: ParseCsvResult["format"], raw: string): "buy" | "sell" | null {
  const operation = raw.trim().toLocaleLowerCase("pt-BR");
  if (format === "b3") {
    if (operation === "c") return "buy";
    if (operation === "v") return "sell";
    return null;
  }
  if (operation.includes("compra")) return "buy";
  if (operation.includes("venda")) return "sell";
  return null;
}

function rawTransactionFor(format: ParseCsvResult["format"], row: Record<string, string>): RawCsvTransaction {
  if (format === "b3") {
    return {
      ticker: row["Código de Negociação"] || row.codigo || "",
      operation: row["C/V"] || row.cv || "",
      quantity: row.Quantidade || "",
      price: row["Preço"] || "",
      date: row["Data do Negócio"] || row.data || "",
    };
  }
  if (format === "xp") {
    return {
      ticker: row.Ativo || "",
      operation: row["Operação"] || "",
      quantity: row.Quantidade || "",
      price: row["Preço"] || "",
      date: row.Data || "",
    };
  }
  if (format === "rico") {
    return {
      ticker: row.Papel || "",
      operation: row["Tipo Operação"] || "",
      quantity: row.Qtde || "",
      price: row["Preço"] || "",
      date: row["Data Negócio"] || "",
    };
  }
  return {
    ticker: row["Código"] || "",
    operation: row.Natureza || "",
    quantity: row.Quantidade || "",
    price: row["Preço"] || "",
    date: row["Data Negociação"] || "",
  };
}

function validateRow(format: Exclude<ParseCsvResult["format"], "unknown">, row: Record<string, string>, sourceLine: number) {
  const raw = rawTransactionFor(format, row);
  const errors: CsvValidationError[] = [];
  const ticker = normalizeTicker(raw.ticker);
  if (!ticker || ticker.length > 32) errors.push({ line: sourceLine, field: "ticker", message: "Ticker ausente ou inválido" });

  const type = parseOperation(format, raw.operation);
  if (!type) errors.push({ line: sourceLine, field: "operação", message: "Operação deve indicar compra ou venda" });

  const quantity = parseBrazilianNumber(raw.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) errors.push({ line: sourceLine, field: "quantidade", message: "Quantidade deve ser positiva" });

  const price = parseBrazilianNumber(raw.price);
  if (!Number.isFinite(price) || price <= 0) errors.push({ line: sourceLine, field: "preço", message: "Preço deve ser positivo" });

  const date = parseBusinessDate(raw.date);
  if (!date) errors.push({ line: sourceLine, field: "data", message: "Data inválida; use dd/mm/aaaa ou aaaa-mm-dd" });

  if (errors.length > 0 || !type || !date) return { errors, transaction: null };
  return {
    errors,
    transaction: {
      ticker,
      type,
      quantity,
      price,
      totalCost: quantity * price,
      fees: 0,
      date,
      assetClass: inferAssetClass(ticker),
      sourceLine,
    } satisfies ParsedTransaction,
  };
}

export function parseCSV(csvContent: string): ParseCsvResult {
  let records: Record<string, string>[];
  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    return { transactions: [], format: "unknown", total: 0, errors: [{ line: 1, message: "CSV inválido ou malformado" }] };
  }

  if (records.length === 0) return { transactions: [], format: "unknown", total: 0, errors: [] };

  const format = detectFormat(Object.keys(records[0]));
  if (format === "unknown") {
    return { transactions: [], format, total: 0, errors: [{ line: 1, message: "Formato de CSV não reconhecido" }] };
  }

  const transactions: ParsedTransaction[] = [];
  const errors: CsvValidationError[] = [];
  records.forEach((row, index) => {
    const result = validateRow(format, row, index + 2);
    errors.push(...result.errors);
    if (result.transaction) transactions.push(result.transaction);
  });

  return { transactions, format, total: transactions.length, errors };
}
