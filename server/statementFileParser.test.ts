import { describe, expect, it } from "vitest";
import { detectStatementFileType } from "./lib/statementFileParser";
import { parseXPDividendsPDFText } from "./lib/pdfDividendParser";

describe("importação de extratos XP", () => {
  it("aceita PDF, XLSX e XLS e rejeita formatos não suportados", () => {
    expect(detectStatementFileType("extrato.pdf")).toBe("pdf");
    expect(detectStatementFileType("Extrato.XLSX")).toBe("xlsx");
    expect(detectStatementFileType("extrato.xls")).toBe("xlsx");
    expect(() => detectStatementFileType("extrato.csv")).toThrow("Formato não suportado");
  });

  it("extrai dividendos e JCP de um texto de extrato PDF", () => {
    const entries = parseXPDividendsPDFText(`
      Proventos
      Ativo  Indexador  Data Provisão Pagamento  Quantidade Provisionada  Provisionado
      BBDC4  JUROS SOBRE CAPITAL PROPRIO  31/07/2026  1042  R$ 19,77
      XPML11  RENDIMENTO  15/08/2026  115  R$ 103,04
      PRÓXIMOS EVENTOS
    `);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ ticker: "BBDC4", type: "jcp", quantity: 1042, totalValue: 19.77 });
    expect(entries[1]).toMatchObject({ ticker: "XPML11", type: "rendimento", quantity: 115, totalValue: 103.04 });
  });
});
