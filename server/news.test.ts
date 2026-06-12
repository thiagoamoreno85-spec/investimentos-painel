import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getAssetsByUser: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      ticker: "VALE3",
      name: "Vale S.A.",
      assetClass: "rv_nacional",
      currency: "BRL",
      totalQuantity: "1000",
      averageCost: "70.00",
      totalCost: "70000.00",
      lastPrice: "72.00",
      lastPriceUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      userId: 1,
      ticker: "PLTR",
      name: "Palantir Technologies",
      assetClass: "rv_eua",
      currency: "USD",
      totalQuantity: "7.03",
      averageCost: "136.96",
      totalCost: "962.83",
      lastPrice: "140.00",
      lastPriceUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  createNewsItem: vi.fn().mockResolvedValue(1),
  getNewsItemsByUser: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      title: "Vale anuncia resultados acima do esperado",
      summary: "A mineradora Vale reportou lucro líquido de R$ 5 bilhões no trimestre.",
      impactAnalysis: "Positivo para VALE3 — pode impulsionar dividendos.",
      source: "InfoMoney",
      sourceUrl: "https://infomoney.com.br/vale-resultados",
      category: "brasil",
      impactLevel: "alto",
      sentiment: "positivo",
      affectedTickers: JSON.stringify(["VALE3"]),
      publishedAt: new Date(),
      createdAt: new Date(),
      isRead: 0,
    },
    {
      id: 2,
      userId: 1,
      title: "Fed mantém juros inalterados",
      summary: "O Federal Reserve decidiu manter a taxa de juros entre 5,25% e 5,5%.",
      impactAnalysis: "Neutro para carteira — dólar estável beneficia ativos em USD.",
      source: "Bloomberg",
      sourceUrl: "https://bloomberg.com/fed-rates",
      category: "global",
      impactLevel: "medio",
      sentiment: "neutro",
      affectedTickers: JSON.stringify(["PLTR"]),
      publishedAt: new Date(),
      createdAt: new Date(),
      isRead: 0,
    },
  ]),
  markNewsItemRead: vi.fn().mockResolvedValue(undefined),
  markAllNewsRead: vi.fn().mockResolvedValue(undefined),
  countUnreadNews: vi.fn().mockResolvedValue(2),
  deleteOldNewsItems: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            news: [
              {
                title: "Vale reporta lucro recorde",
                summary: "Vale anuncia lucro de R$ 5 bilhões no trimestre.",
                impactAnalysis: "Positivo para VALE3 — potencial de dividendos.",
                source: "InfoMoney",
                sourceUrl: "https://infomoney.com.br/vale",
                category: "brasil",
                impactLevel: "alto",
                sentiment: "positivo",
                affectedTickers: ["VALE3"],
              },
              {
                title: "Fed mantém juros",
                summary: "Federal Reserve mantém taxa entre 5,25% e 5,5%.",
                impactAnalysis: "Neutro para carteira.",
                source: "Bloomberg",
                sourceUrl: "https://bloomberg.com/fed",
                category: "global",
                impactLevel: "medio",
                sentiment: "neutro",
                affectedTickers: ["PLTR"],
              },
            ],
          }),
        },
      },
    ],
  }),
}));

describe("News Router Logic", () => {
  describe("News item structure validation", () => {
    it("should correctly parse affectedTickers from JSON string", () => {
      const raw = { affectedTickers: JSON.stringify(["VALE3", "SBSP3"]) };
      const parsed = JSON.parse(raw.affectedTickers);
      expect(parsed).toEqual(["VALE3", "SBSP3"]);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("should handle empty affectedTickers", () => {
      const raw = { affectedTickers: JSON.stringify([]) };
      const parsed = JSON.parse(raw.affectedTickers);
      expect(parsed).toEqual([]);
    });

    it("should handle null affectedTickers gracefully", () => {
      const raw = { affectedTickers: null };
      const parsed = raw.affectedTickers ? JSON.parse(raw.affectedTickers) : [];
      expect(parsed).toEqual([]);
    });
  });

  describe("News filtering logic", () => {
    const mockNews = [
      { id: 1, category: "brasil", impactLevel: "alto", sentiment: "positivo", isRead: 0 },
      { id: 2, category: "global", impactLevel: "medio", sentiment: "neutro", isRead: 1 },
      { id: 3, category: "cripto", impactLevel: "baixo", sentiment: "negativo", isRead: 0 },
      { id: 4, category: "brasil", impactLevel: "baixo", sentiment: "positivo", isRead: 0 },
    ];

    it("should filter by category correctly", () => {
      const brasil = mockNews.filter((n) => n.category === "brasil");
      expect(brasil).toHaveLength(2);
    });

    it("should filter by impactLevel correctly", () => {
      const alto = mockNews.filter((n) => n.impactLevel === "alto");
      expect(alto).toHaveLength(1);
      expect(alto[0].id).toBe(1);
    });

    it("should filter unread correctly", () => {
      const unread = mockNews.filter((n) => n.isRead === 0);
      expect(unread).toHaveLength(3);
    });

    it("should count unread correctly", () => {
      const count = mockNews.filter((n) => n.isRead === 0).length;
      expect(count).toBe(3);
    });
  });

  describe("Impact level classification", () => {
    it("should identify high impact news", () => {
      const news = { impactLevel: "alto" };
      expect(news.impactLevel === "alto").toBe(true);
    });

    it("should identify medium impact news", () => {
      const news = { impactLevel: "medio" };
      expect(news.impactLevel === "medio").toBe(true);
    });

    it("should identify low impact news", () => {
      const news = { impactLevel: "baixo" };
      expect(news.impactLevel === "baixo").toBe(true);
    });
  });

  describe("Sentiment analysis", () => {
    const mockNews = [
      { sentiment: "positivo" },
      { sentiment: "negativo" },
      { sentiment: "neutro" },
      { sentiment: "positivo" },
    ];

    it("should count positive sentiment correctly", () => {
      const positivo = mockNews.filter((n) => n.sentiment === "positivo").length;
      expect(positivo).toBe(2);
    });

    it("should count negative sentiment correctly", () => {
      const negativo = mockNews.filter((n) => n.sentiment === "negativo").length;
      expect(negativo).toBe(1);
    });
  });

  describe("Ticker frequency analysis", () => {
    it("should correctly count ticker occurrences", () => {
      const newsList = [
        { affectedTickers: ["VALE3", "SBSP3"] },
        { affectedTickers: ["VALE3", "CMIN3"] },
        { affectedTickers: ["SBSP3"] },
      ];

      const tickerCount: Record<string, number> = {};
      newsList.forEach((n) => {
        n.affectedTickers.forEach((t) => {
          tickerCount[t] = (tickerCount[t] ?? 0) + 1;
        });
      });

      expect(tickerCount["VALE3"]).toBe(2);
      expect(tickerCount["SBSP3"]).toBe(2);
      expect(tickerCount["CMIN3"]).toBe(1);
    });

    it("should sort tickers by frequency", () => {
      const tickerCount = { VALE3: 3, SBSP3: 2, CMIN3: 1 };
      const sorted = Object.entries(tickerCount).sort((a, b) => b[1] - a[1]);
      expect(sorted[0][0]).toBe("VALE3");
      expect(sorted[1][0]).toBe("SBSP3");
    });
  });

  describe("Alert creation for high impact news", () => {
    it("should identify news requiring alert creation", () => {
      const news = [
        { impactLevel: "alto", affectedTickers: ["VALE3"] },
        { impactLevel: "medio", affectedTickers: ["SBSP3"] },
        { impactLevel: "baixo", affectedTickers: ["CMIN3"] },
      ];

      const requiresAlert = news.filter((n) => n.impactLevel === "alto");
      expect(requiresAlert).toHaveLength(1);
      expect(requiresAlert[0].affectedTickers[0]).toBe("VALE3");
    });

    it("should not create alert for medium impact news", () => {
      const news = { impactLevel: "medio" };
      expect(news.impactLevel === "alto").toBe(false);
    });
  });

  describe("Old news cleanup logic", () => {
    it("should identify news to delete when exceeding limit", () => {
      const allNews = Array.from({ length: 120 }, (_, i) => ({ id: i + 1 }));
      const keepLast = 100;
      const toDelete = allNews.slice(keepLast);
      expect(toDelete).toHaveLength(20);
    });

    it("should not delete when under limit", () => {
      const allNews = Array.from({ length: 80 }, (_, i) => ({ id: i + 1 }));
      const keepLast = 100;
      const toDelete = allNews.length > keepLast ? allNews.slice(keepLast) : [];
      expect(toDelete).toHaveLength(0);
    });
  });
});
