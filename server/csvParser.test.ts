import { describe, expect, it } from "vitest";
import { parseCSV } from "./lib/csvParser";

const xpHeader = "Ativo,Operação,Quantidade,Preço,Data";

describe("parseCSV", () => {
  it("aceita duas operações distintas no mesmo dia", () => {
    const result = parseCSV([
      xpHeader,
      "VALE3,Compra,10,55.20,21/10/2026",
      "PETR4,Venda,5,32.10,21/10/2026",
    ].join("\n"));

    expect(result.format).toBe("xp");
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((transaction) => transaction.ticker)).toEqual(["VALE3", "PETR4"]);
    expect(result.transactions.map((transaction) => transaction.type)).toEqual(["buy", "sell"]);
    expect(result.transactions.map((transaction) => transaction.sourceLine)).toEqual([2, 3]);
  });

  it("normaliza fração e ticker da B3 sem aceitar operação ambígua", () => {
    const valid = parseCSV([
      "Negociação,C/V,Código de Negociação,Quantidade,Preço,Data do Negócio",
      "A vista,C,VALE3F,1.000,55,21/10/2026",
    ].join("\n"));
    expect(valid.errors).toEqual([]);
    expect(valid.transactions[0]).toMatchObject({ ticker: "VALE3", type: "buy", quantity: 1000, price: 55 });

    const invalid = parseCSV([
      xpHeader,
      "VALE3,Transferência,1,55,21/10/2026",
    ].join("\n"));
    expect(invalid.transactions).toEqual([]);
    expect(invalid.errors).toContainEqual(expect.objectContaining({ line: 2, field: "operação" }));
  });

  it("rejeita arquivo desconhecido e linhas semanticamente inválidas antes de gravar", () => {
    const unknown = parseCSV("Ticker,Tipo\nVALE3,Compra");
    expect(unknown.format).toBe("unknown");
    expect(unknown.errors).toHaveLength(1);

    const invalid = parseCSV([
      xpHeader,
      "VALE3,Compra,0,50,31/02/2026",
    ].join("\n"));
    expect(invalid.errors.map((error) => error.field)).toEqual(expect.arrayContaining(["quantidade", "data"]));
  });
});
