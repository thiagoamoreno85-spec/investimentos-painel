import { describe, expect, it } from "vitest";
import { prioritizeNewsForPortfolio } from "./services/newsPrioritization";
import { hasIrrecoverableNewsEncoding, sanitizeNewsText } from "./services/newsText";

describe("sanitizeNewsText", () => {
  it("remove markup e decodifica entidades HTML simples, numéricas e duplamente codificadas", () => {
    const text = sanitizeNewsText(
      '<a href="https://example.com">A&ccedil;&atilde;o &amp;amp; mercado &#x2014; &quot;Brasil&quot;</a>'
    );

    expect(text).toBe('Ação & mercado — "Brasil"');
  });

  it("remove conteúdo de script, espaços excedentes e caractere de substituição", () => {
    const text = sanitizeNewsText('  Bolsa <script>alert("x")</script> n\uFFFDo   ');

    expect(text).toBe("Bolsa no");
  });

  it("identifica registros legados com caracteres perdidos para que não sejam exibidos", () => {
    expect(hasIrrecoverableNewsEncoding("Infla\uFFFD\uFFFDo")).toBe(true);
    expect(hasIrrecoverableNewsEncoding("Inflação controlada")).toBe(false);
  });
});

describe("prioritizeNewsForPortfolio", () => {
  const assets = [
    { ticker: "VALE3", totalQuantity: "1000", lastPrice: "100", currency: "BRL" },
    { ticker: "PLTR", totalQuantity: "10", lastPrice: "100", currency: "USD" },
  ];

  it("coloca primeiro uma notícia de alto impacto ligada à maior posição da carteira", () => {
    const now = new Date();
    const result = prioritizeNewsForPortfolio([
      {
        id: 1,
        impactLevel: "alto",
        affectedTickers: ["PLTR"],
        createdAt: now,
        isRead: 0,
      },
      {
        id: 2,
        impactLevel: "alto",
        affectedTickers: ["VALE3.SA"],
        createdAt: now,
        isRead: 0,
      },
      {
        id: 3,
        impactLevel: "alto",
        affectedTickers: [],
        createdAt: now,
        isRead: 0,
      },
    ], assets, 5);

    expect(result.map((item) => item.id)).toEqual([2, 1, 3]);
    expect(result[0]?.matchedTickers).toEqual(["VALE3"]);
    expect(result[0]?.portfolioRelevance).toBe("alta");
    expect(result[0]?.affectedPortfolioPct).toBeCloseTo(100_000 / 105_000 * 100, 6);
  });

  it("mantém o contexto macro na lista, mas atrás de notícias com vínculo direto", () => {
    const now = new Date();
    const result = prioritizeNewsForPortfolio([
      { id: 1, impactLevel: "medio", affectedTickers: [], createdAt: now, isRead: 0 },
      { id: 2, impactLevel: "baixo", affectedTickers: ["VALE3"], createdAt: now, isRead: 1 },
    ], assets, 5);

    expect(result[0]?.id).toBe(2);
    expect(result[0]?.portfolioRelevance).toBe("direta");
    expect(result[1]?.portfolioRelevance).toBe("contexto");
  });
});
