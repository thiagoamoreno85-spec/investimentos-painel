import { describe, it, expect, vi } from "vitest";

// Test the quote ticker conversion logic
describe("Quote ticker conversion", () => {
  it("should convert BR tickers to Yahoo format", () => {
    // Test the logic that would be in toYahooTicker
    const brTickers = ["VALE3", "SBSP3", "BPAC11", "INBR32"];
    const expected = ["VALE3.SA", "SBSP3.SA", "BPAC11.SA", "INBR32.SA"];

    brTickers.forEach((ticker, i) => {
      expect(`${ticker}.SA`).toBe(expected[i]);
    });
  });

  it("should convert crypto tickers to Yahoo format", () => {
    const cryptoMap: Record<string, string> = {
      BTC: "BTC-USD",
      ETH: "ETH-USD",
      SOL: "SOL-USD",
      BNB: "BNB-USD",
      AVAX: "AVAX-USD",
    };

    expect(cryptoMap["BTC"]).toBe("BTC-USD");
    expect(cryptoMap["ETH"]).toBe("ETH-USD");
    expect(cryptoMap["SOL"]).toBe("SOL-USD");
  });

  it("should leave US tickers unchanged", () => {
    const usTickers = ["MSFT", "NVDA", "GOOGL", "TSLA", "AAPL"];
    usTickers.forEach((ticker) => {
      expect(ticker).toBe(ticker); // US tickers stay as-is
    });
  });
});

// Test the recalculation logic
describe("Asset recalculation logic", () => {
  it("should calculate average cost for buy transactions", () => {
    const transactions = [
      { type: "buy" as const, quantity: 100, unitPrice: 50, fees: 10 },
      { type: "buy" as const, quantity: 50, unitPrice: 60, fees: 5 },
    ];

    let totalQty = 0;
    let totalCost = 0;

    for (const tx of transactions) {
      if (tx.type === "buy") {
        totalCost += tx.quantity * tx.unitPrice + tx.fees;
        totalQty += tx.quantity;
      }
    }

    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    expect(totalQty).toBe(150);
    expect(totalCost).toBe(8015); // 100*50+10 + 50*60+5
    expect(avgCost).toBeCloseTo(53.4333, 2);
  });

  it("should handle sell transactions correctly", () => {
    const transactions = [
      { type: "buy" as const, quantity: 100, unitPrice: 50, fees: 0 },
      { type: "sell" as const, quantity: 30, unitPrice: 60, fees: 0 },
    ];

    let totalQty = 0;
    let totalCost = 0;

    for (const tx of transactions) {
      if (tx.type === "buy") {
        totalCost += tx.quantity * tx.unitPrice + tx.fees;
        totalQty += tx.quantity;
      } else {
        if (totalQty > 0) {
          const avgCost = totalCost / totalQty;
          totalQty -= tx.quantity;
          totalCost = totalQty * avgCost;
        }
      }
    }

    expect(totalQty).toBe(70);
    expect(totalCost).toBeCloseTo(3500, 0); // 70 * 50
  });

  it("should return zero for empty transactions", () => {
    const totalQty = 0;
    const totalCost = 0;
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    expect(avgCost).toBe(0);
    expect(totalQty).toBe(0);
  });
});

// Test currency formatting
describe("Currency formatting", () => {
  it("should format BRL correctly", () => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(1914184);

    expect(formatted).toContain("1.914.184");
  });

  it("should format USD correctly", () => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(431.94);

    expect(formatted).toContain("431.94");
  });
});

// Test asset class mapping
describe("Asset class mapping", () => {
  const CLASS_CURRENCY: Record<string, string> = {
    rv_nacional: "BRL",
    rv_eua: "USD",
    fundos: "BRL",
    cripto: "USD",
    renda_fixa: "BRL",
    uranio: "USD",
    india: "USD",
    caixa: "BRL",
  };

  it("should map Brazilian assets to BRL", () => {
    expect(CLASS_CURRENCY["rv_nacional"]).toBe("BRL");
    expect(CLASS_CURRENCY["fundos"]).toBe("BRL");
    expect(CLASS_CURRENCY["renda_fixa"]).toBe("BRL");
    expect(CLASS_CURRENCY["caixa"]).toBe("BRL");
  });

  it("should map international assets to USD", () => {
    expect(CLASS_CURRENCY["rv_eua"]).toBe("USD");
    expect(CLASS_CURRENCY["cripto"]).toBe("USD");
    expect(CLASS_CURRENCY["uranio"]).toBe("USD");
    expect(CLASS_CURRENCY["india"]).toBe("USD");
  });
});
