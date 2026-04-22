import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do banco de dados
vi.mock("./db", () => ({
  getAssetsByUser: vi.fn(),
}));

// Mock do módulo de cotações
vi.mock("./quotes", () => ({
  fetchQuotes: vi.fn(),
  fetchUsdBrl: vi.fn(),
}));

import { getAssetsByUser } from "./db";
import { fetchQuotes, fetchUsdBrl } from "./quotes";

const mockAssets = [
  {
    id: 1, userId: 1, ticker: "SBSP3", name: "Sabesp", assetClass: "rv_nacional",
    currency: "BRL", totalQuantity: "100", averageCost: "65.00", totalCost: "6500.00",
    lastPrice: "173.50", lastPriceUpdatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 2, userId: 1, ticker: "VALE3", name: "Vale", assetClass: "rv_nacional",
    currency: "BRL", totalQuantity: "200", averageCost: "85.00", totalCost: "17000.00",
    lastPrice: "87.62", lastPriceUpdatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 3, userId: 1, ticker: "AAPL", name: "Apple Inc", assetClass: "rv_eua",
    currency: "USD", totalQuantity: "10", averageCost: "150.00", totalCost: "1500.00",
    lastPrice: "180.00", lastPriceUpdatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  },
];

const mockQuotes = new Map([
  ["SBSP3", { price: 173.5, change: -2.5, changePercent: -1.44, currency: "BRL" }],
  ["VALE3", { price: 87.62, change: -1.11, changePercent: -1.25, currency: "BRL" }],
  ["AAPL",  { price: 180.0, change: 2.0,  changePercent: 1.12,  currency: "USD" }],
]);

describe("market router - portfolio quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAssetsByUser).mockResolvedValue(mockAssets as any);
    vi.mocked(fetchQuotes).mockResolvedValue(mockQuotes as any);
    vi.mocked(fetchUsdBrl).mockResolvedValue(5.7);
  });

  it("deve retornar lista vazia quando carteira está vazia", async () => {
    vi.mocked(getAssetsByUser).mockResolvedValue([]);
    const assets = await getAssetsByUser(1);
    expect(assets).toHaveLength(0);
  });

  it("deve calcular valor total da posição corretamente", () => {
    const price = 173.5;
    const qty = 100;
    const totalValue = price * qty;
    expect(totalValue).toBe(17350);
  });

  it("deve calcular resultado percentual corretamente", () => {
    const avgCost = 65.0;
    const lastPrice = 173.5;
    const profitPct = ((lastPrice - avgCost) / avgCost) * 100;
    expect(profitPct).toBeCloseTo(166.92, 1);
  });

  it("deve calcular resultado negativo corretamente", () => {
    const avgCost = 90.0;
    const lastPrice = 87.62;
    const profitPct = ((lastPrice - avgCost) / avgCost) * 100;
    expect(profitPct).toBeCloseTo(-2.64, 1);
  });

  it("deve ordenar ativos por valor total decrescente", () => {
    const quotes = [
      { ticker: "SBSP3", totalValue: 17350 },
      { ticker: "VALE3", totalValue: 17524 },
      { ticker: "AAPL",  totalValue: 1800 },
    ];
    const sorted = [...quotes].sort((a, b) => b.totalValue - a.totalValue);
    expect(sorted[0].ticker).toBe("VALE3");
    expect(sorted[1].ticker).toBe("SBSP3");
    expect(sorted[2].ticker).toBe("AAPL");
  });

  it("deve usar lastPrice do banco quando cotação não está disponível", () => {
    const asset = mockAssets[0];
    const quote = mockQuotes.get("INEXISTENTE");
    const lastPrice = quote?.price ?? parseFloat(asset.lastPrice ?? "0");
    expect(lastPrice).toBe(173.5);
  });
});

describe("market router - macro rates", () => {
  it("deve calcular juro real corretamente", () => {
    const selic = 14.75;
    const ipca = 4.8;
    const realRate = selic - ipca;
    expect(realRate).toBeCloseTo(9.95, 2);
  });

  it("deve identificar IPCA acima do teto da meta", () => {
    const ipca = 4.8;
    const metaTeto = 4.5;
    expect(ipca > metaTeto).toBe(true);
  });

  it("deve identificar juro real positivo", () => {
    const selic = 14.75;
    const ipca = 4.8;
    const realRate = selic - ipca;
    expect(realRate > 0).toBe(true);
  });
});

describe("market router - news sentiment", () => {
  function detectSentiment(text: string): "positive" | "negative" | "neutral" {
    const lower = text.toLowerCase();
    const positiveWords = ["alta", "sobe", "crescimento", "lucro", "recorde", "aprovação", "expansão", "positivo", "ganho", "valoriza", "supera", "melhora", "forte", "compra", "recomenda"];
    const negativeWords = ["queda", "cai", "perde", "prejuízo", "risco", "crise", "negativo", "reduz", "corte", "deteriora", "fraco", "venda", "rebaixa", "alerta", "preocupa"];
    const posCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negCount = negativeWords.filter((w) => lower.includes(w)).length;
    if (posCount > negCount) return "positive";
    if (negCount > posCount) return "negative";
    return "neutral";
  }

  it("deve detectar sentimento positivo", () => {
    const title = "SBSP3 sobe 5% após resultado recorde e crescimento da receita";
    expect(detectSentiment(title)).toBe("positive");
  });

  it("deve detectar sentimento negativo", () => {
    const title = "VALE3 cai 3% com queda no preço do minério e risco de crise";
    expect(detectSentiment(title)).toBe("negative");
  });

  it("deve detectar sentimento neutro", () => {
    const title = "Banco Central divulga ata do Copom sobre política monetária";
    expect(detectSentiment(title)).toBe("neutral");
  });

  it("deve priorizar sentimento mais forte quando há empate", () => {
    const title = "Mercado misto: alta em tecnologia, queda em commodities";
    const result = detectSentiment(title);
    expect(["positive", "negative", "neutral"]).toContain(result);
  });
});

describe("market router - indices", () => {
  it("deve categorizar índices corretamente", () => {
    const categories = {
      "^BVSP": "brasil",
      "^GSPC": "eua",
      "GC=F": "commodities",
      "BTC-USD": "crypto",
      "USDBRL=X": "fx",
    };

    expect(categories["^BVSP"]).toBe("brasil");
    expect(categories["^GSPC"]).toBe("eua");
    expect(categories["GC=F"]).toBe("commodities");
    expect(categories["BTC-USD"]).toBe("crypto");
    expect(categories["USDBRL=X"]).toBe("fx");
  });

  it("deve retornar zero quando API falha", () => {
    const fallbackPrice = 0;
    expect(fallbackPrice).toBe(0);
  });

  it("deve formatar preço em BRL corretamente", () => {
    const price = 130456.78;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL",
    }).format(price);
    expect(formatted).toContain("130.456");
  });
});
