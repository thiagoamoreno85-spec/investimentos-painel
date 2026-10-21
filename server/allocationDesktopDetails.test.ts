import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const allocationSource = readFileSync(
  new URL("../client/src/pages/Alocacao.tsx", import.meta.url),
  "utf8",
);

describe("detalhes expansíveis da tabela desktop de alocação", () => {
  it("mantém estado desktop independente e controles semânticos acessíveis", () => {
    expect(allocationSource).toContain("expandedDesktopAssetId");
    expect(allocationSource).toContain("aria-expanded={isExpanded}");
    expect(allocationSource).toContain("aria-controls={detailId}");
    expect(allocationSource).toContain("focus-visible:ring-2 focus-visible:ring-ring");
  });

  it("renderiza detalhes com a extensão correta para fundos, renda fixa e demais classes", () => {
    expect(allocationSource).toContain("colSpan={isFixedIncome ? 9 : 5}");
    expect(allocationSource).toContain("colSpan={7}");
    expect(allocationSource).toContain("<td colSpan={colSpan}");
  });

  it("não atribui role=button às linhas das tabelas desktop", () => {
    const desktopTableSource = allocationSource.slice(
      allocationSource.indexOf("/* ── Tabela: thead sticky, tbody scroll ── */"),
    );
    expect(desktopTableSource).not.toMatch(/<tr[^>]*role="button"/);
  });
});
