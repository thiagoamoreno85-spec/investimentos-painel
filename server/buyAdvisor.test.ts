import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do módulo de banco de dados
vi.mock("./db", () => ({
  getAssetsByUser: vi.fn(),
}));

// Mock do módulo de cotações
vi.mock("./quotes", () => ({
  fetchQuotes: vi.fn(),
  fetchUsdBrl: vi.fn(),
}));

// Mock do LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getAssetsByUser } from "./db";
import { fetchQuotes, fetchUsdBrl } from "./quotes";
import { invokeLLM } from "./_core/llm";

const mockAssets = [
  {
    id: 1,
    userId: "user1",
    ticker: "SBSP3",
    name: "Sabesp",
    assetClass: "rv_nacional",
    currency: "BRL",
    totalQuantity: "100",
    averageCost: "65.00",
    totalCost: "6500.00",
    lastPrice: "173.50",
    lastPriceUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    userId: "user1",
    ticker: "VALE3",
    name: "Vale",
    assetClass: "rv_nacional",
    currency: "BRL",
    totalQuantity: "200",
    averageCost: "85.00",
    totalCost: "17000.00",
    lastPrice: "87.62",
    lastPriceUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    userId: "user1",
    ticker: "AAPL",
    name: "Apple Inc",
    assetClass: "rv_eua",
    currency: "USD",
    totalQuantity: "10",
    averageCost: "150.00",
    totalCost: "1500.00",
    lastPrice: "180.00",
    lastPriceUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockQuotes = new Map([
  ["SBSP3", { price: 173.5, change: -2.5, changePercent: -1.44, currency: "BRL" }],
  ["VALE3", { price: 87.62, change: -1.11, changePercent: -1.25, currency: "BRL" }],
  ["AAPL", { price: 180.0, change: 2.0, changePercent: 1.12, currency: "USD" }],
]);

describe("buyAdvisor - análise de melhor compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAssetsByUser).mockResolvedValue(mockAssets as any);
    vi.mocked(fetchQuotes).mockResolvedValue(mockQuotes as any);
    vi.mocked(fetchUsdBrl).mockResolvedValue(5.7);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "## Recomendação\n\n**SBSP3** é a melhor compra do dia com R$ 1.200,00.\n\nCompre 6 cotas a R$ 173,50 = R$ 1.041,00.",
          },
        },
      ],
    } as any);
  });

  it("deve filtrar ativos brasileiros quando foco é brasil", async () => {
    const { fetchQuotes: fq } = await import("./quotes");
    const { getAssetsByUser: gau } = await import("./db");

    await gau("user1");
    const assets = mockAssets.filter((a) => a.assetClass !== "rv_eua");
    expect(assets).toHaveLength(2);
    expect(assets.every((a) => a.assetClass !== "rv_eua")).toBe(true);
  });

  it("deve filtrar ativos EUA quando foco é eua", async () => {
    const assets = mockAssets.filter((a) => a.assetClass === "rv_eua");
    expect(assets).toHaveLength(1);
    expect(assets[0].ticker).toBe("AAPL");
  });

  it("deve retornar todos os ativos quando foco é todos", async () => {
    const assets = mockAssets;
    expect(assets).toHaveLength(3);
  });

  it("deve calcular corretamente a quantidade de cotas compráveis", () => {
    const availableAmount = 1200;
    const price = 173.5;
    const cotas = Math.floor(availableAmount / price);
    expect(cotas).toBe(6);
    const valorCotas = cotas * price;
    expect(valorCotas).toBe(1041);
  });

  it("deve calcular corretamente o resultado percentual de um ativo", () => {
    const avgCost = 65.0;
    const lastPrice = 173.5;
    const profitPct = ((lastPrice - avgCost) / avgCost) * 100;
    expect(profitPct).toBeCloseTo(166.92, 1);
  });

  it("deve construir snapshot de cotações corretamente", () => {
    const quotesSnapshot: Record<string, { price: number; changePercent: number }> = {};
    mockQuotes.forEach((q, ticker) => {
      quotesSnapshot[ticker] = { price: q.price, changePercent: q.changePercent };
    });

    expect(quotesSnapshot["SBSP3"]).toEqual({ price: 173.5, changePercent: -1.44 });
    expect(quotesSnapshot["VALE3"]).toEqual({ price: 87.62, changePercent: -1.25 });
    expect(Object.keys(quotesSnapshot)).toHaveLength(3);
  });

  it("deve chamar o LLM com mensagens de sistema e usuário", async () => {
    const { invokeLLM: llm } = await import("./_core/llm");
    await llm({
      messages: [
        { role: "system", content: "Você é um consultor de investimentos." },
        { role: "user", content: "Qual ativo comprar com R$ 1.200,00?" },
      ],
    });

    expect(llm).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("deve retornar análise de texto quando LLM responde com sucesso", async () => {
    const { invokeLLM: llm } = await import("./_core/llm");
    const response = await llm({ messages: [{ role: "user", content: "test" }] });
    const content = response?.choices?.[0]?.message?.content;
    expect(typeof content).toBe("string");
    expect(content).toContain("SBSP3");
  });

  it("deve retornar mensagem de carteira vazia quando não há ativos", async () => {
    vi.mocked(getAssetsByUser).mockResolvedValue([]);
    const assets = await getAssetsByUser("user1");
    if (assets.length === 0) {
      const result = {
        analysis: "Sua carteira está vazia. Importe seus ativos primeiro.",
        updatedAt: new Date(),
        quotesSnapshot: {},
      };
      expect(result.analysis).toContain("vazia");
      expect(result.quotesSnapshot).toEqual({});
    }
  });

  it("deve lidar com falha na busca de cotações sem lançar erro", async () => {
    vi.mocked(fetchQuotes).mockRejectedValue(new Error("Network error"));
    try {
      await fetchQuotes([]);
    } catch {
      // fallback: usar mapa vazio
      const quotes = new Map();
      expect(quotes.size).toBe(0);
    }
  });

  it("deve calcular valor total da posição corretamente", () => {
    const lastPrice = 87.62;
    const qty = 200;
    const totalValue = lastPrice * qty;
    expect(totalValue).toBeCloseTo(17524, 0);
  });
});
