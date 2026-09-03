import { describe, expect, it } from "vitest";
import { buildPerformanceCsv } from "../client/src/lib/performanceCsv";

describe("buildPerformanceCsv", () => {
  it("preserva o cabeçalho, usa separador compatível com Excel e escapa aspas", () => {
    const csv = buildPerformanceCsv("2026-09-03", "Intradiário", [{
      ticker: "VALE3",
      name: "Vale \"ON\"",
      classLabel: "RV Nacional",
      currency: "BRL",
      marketPnlBRL: 12.5,
      incomePnlBRL: 0,
      changeBRL: 12.5,
      changePct: 0.1234,
      startValueBRL: 1000,
      valueBRL: 1012.5,
    }]);

    expect(csv.startsWith("\uFEFF\"Data\";\"Origem\"")).toBe(true);
    expect(csv).toContain('"Vale ""ON"""');
    expect(csv).toContain('"12.50";"0.00";"12.50";"0.1234"');
  });
});
