import { readFile } from "node:fs/promises";
import { parseXPDividendsPDFBuffer } from "../server/lib/pdfDividendParser";

const statementPath = "/home/ubuntu/upload/Ago26eua.pdf";
const buffer = await readFile(statementPath);
const entries = await parseXPDividendsPDFBuffer(buffer);

console.log(JSON.stringify({ bytes: buffer.length, extractedEntries: entries.length }, null, 2));
