import { extname } from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_EXTRACTED_DOCUMENT_CHARACTERS = 80_000;

export type AdvisorDocumentKind = "pdf" | "txt" | "csv" | "xlsx" | "xls" | "docx";

export type ParsedAdvisorDocument = {
  kind: AdvisorDocumentKind;
  text: string;
  extractedCharacters: number;
};

const documentKinds: Record<string, AdvisorDocumentKind> = {
  ".pdf": "pdf",
  ".txt": "txt",
  ".csv": "csv",
  ".xlsx": "xlsx",
  ".xls": "xls",
  ".docx": "docx",
};

function invalidDocument(): never {
  throw new Error("Não foi possível ler o documento.");
}

/** Decodifica somente base64 canônico, sem aceitar bytes silenciosamente descartados pelo Buffer. */
export function decodeBase64(base64: string): Buffer {
  if (
    base64.length === 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new Error("Base64 inválido.");
  }

  const decoded = Buffer.from(base64, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== base64) {
    throw new Error("Base64 inválido.");
  }

  return decoded;
}

export function detectAdvisorDocumentKind(name: string): AdvisorDocumentKind {
  const kind = documentKinds[extname(name).toLowerCase()];
  if (!kind) {
    throw new Error("Formato de documento não suportado.");
  }
  return kind;
}

function assertNotExecutable(buffer: Buffer): void {
  const magic = buffer.subarray(0, 4);
  const isMachO = [
    "feedface", "cefaedfe", "feedfacf", "cffaedfe", "cafebabe", "bebafeca",
  ].includes(magic.toString("hex"));
  if (
    magic.subarray(0, 2).toString("ascii") === "MZ" ||
    magic.subarray(0, 4).toString("ascii") === "\x7fELF" ||
    magic.subarray(0, 2).toString("ascii") === "#!" ||
    isMachO
  ) {
    throw new Error("Formato de documento não suportado.");
  }
}

function truncateText(text: string): string {
  return text.replace(/^\uFEFF/, "").slice(0, MAX_EXTRACTED_DOCUMENT_CHARACTERS);
}

function decodeUtf8(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    invalidDocument();
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    if (typeof parsed.text !== "string") invalidDocument();
    return parsed.text;
  } catch {
    invalidDocument();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function extractSpreadsheet(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellText: true,
      bookVBA: false,
      WTF: false,
    });

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return "";
      // XLSX apenas lê valores armazenados; não calcula nem executa fórmulas.
      return `[Planilha: ${name}]\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`;
    }).filter(Boolean);

    if (sheets.length === 0) invalidDocument();
    return sheets.join("\n\n");
  } catch {
    invalidDocument();
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Lê somente word/document.xml usando um arquivo temporário removido em seguida.
 * O teto de saída limita documentos DOCX com XML descompactado excessivo.
 */
async function extractDocx(buffer: Buffer): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "wealth-advisor-docx-"));
  const tempFile = join(directory, "attachment.docx");
  let xml: Buffer;

  try {
    await writeFile(tempFile, buffer, { mode: 0o600 });
    xml = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn("unzip", ["-p", tempFile, "word/document.xml"]);
      const chunks: Buffer[] = [];
      let size = 0;
      let stderr = "";
      let settled = false;
      const maxXmlBytes = MAX_EXTRACTED_DOCUMENT_CHARACTERS * 8;

      const fail = () => {
        if (!settled) {
          settled = true;
          child.kill();
          reject(new Error("invalid docx"));
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxXmlBytes) {
          fail();
          return;
        }
        chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", fail);
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (code !== 0 || stderr || chunks.length === 0) {
          reject(new Error("invalid docx"));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const source = decodeUtf8(xml);
  if (!/<w:document\b/i.test(source)) invalidDocument();

  return decodeXmlEntities(
    source
      .replace(/<w:tab\b[^>]*\/?>(?:<\/w:tab>)?/gi, "\t")
      .replace(/<w:br\b[^>]*\/?>(?:<\/w:br>)?/gi, "\n")
      .replace(/<\/w:p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

/** Extrai texto de documento exclusivamente em memória e limita o contexto enviado ao modelo. */
export async function parseAdvisorDocument(buffer: Buffer, name: string): Promise<ParsedAdvisorDocument> {
  if (buffer.length === 0) {
    throw new Error("O documento está vazio.");
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error("O documento excede o limite de 8 MB.");
  }

  const kind = detectAdvisorDocumentKind(name);
  assertNotExecutable(buffer);
  let text: string;
  try {
    if (kind === "txt" || kind === "csv") {
      text = decodeUtf8(buffer);
    } else if (kind === "pdf") {
      text = await extractPdf(buffer);
    } else if (kind === "docx") {
      text = await extractDocx(buffer);
    } else {
      text = extractSpreadsheet(buffer);
    }
  } catch (error) {
    if (error instanceof Error && ["O documento está vazio.", "O documento excede o limite de 8 MB.", "Formato de documento não suportado.", "Base64 inválido."].includes(error.message)) {
      throw error;
    }
    invalidDocument();
  }

  const truncated = truncateText(text);
  if (truncated.trim().length === 0) invalidDocument();

  return {
    kind,
    text: truncated,
    extractedCharacters: truncated.length,
  };
}
