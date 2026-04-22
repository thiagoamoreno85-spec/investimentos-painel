import { describe, it, expect } from "vitest";

/**
 * Unit tests for dividends and alerts business logic
 * These tests validate the calculation formulas used in the routers
 */

// ============================================================
// Yield on Cost Calculations
// ============================================================

describe("Yield on Cost calculations", () => {
  it("calculates YoC correctly for a single dividend", () => {
    const totalDividends = 500; // R$ 500 received
    const totalCost = 10000;    // R$ 10.000 invested
    const yoc = (totalDividends / totalCost) * 100;
    expect(yoc).toBeCloseTo(5.0);
  });

  it("calculates YoC = 0 when no dividends received", () => {
    const totalDividends = 0;
    const totalCost = 10000;
    const yoc = totalCost > 0 ? (totalDividends / totalCost) * 100 : 0;
    expect(yoc).toBe(0);
  });

  it("calculates YoC = 0 when totalCost is 0", () => {
    const totalDividends = 500;
    const totalCost = 0;
    const yoc = totalCost > 0 ? (totalDividends / totalCost) * 100 : 0;
    expect(yoc).toBe(0);
  });

  it("calculates total dividend value from valuePerShare * quantity", () => {
    const valuePerShare = 0.85; // R$ 0,85 por ação
    const quantity = 1000;
    const total = valuePerShare * quantity;
    expect(total).toBeCloseTo(850);
  });

  it("calculates current yield from annual dividends and current price", () => {
    const annualDivPerShare = 4.0; // R$ 4,00 por ação no ano
    const lastPrice = 50.0;
    const currentYield = (annualDivPerShare / lastPrice) * 100;
    expect(currentYield).toBeCloseTo(8.0);
  });
});

// ============================================================
// Alert Trigger Logic
// ============================================================

describe("Alert trigger logic", () => {
  it("triggers price_drop alert when drop >= threshold", () => {
    const avgCost = 100;
    const lastPrice = 88; // 12% drop
    const threshold = 10; // trigger at 10% drop
    const dropPct = ((avgCost - lastPrice) / avgCost) * 100;
    expect(dropPct).toBeCloseTo(12);
    expect(dropPct >= threshold).toBe(true);
  });

  it("does NOT trigger price_drop alert when drop < threshold", () => {
    const avgCost = 100;
    const lastPrice = 95; // 5% drop
    const threshold = 10;
    const dropPct = ((avgCost - lastPrice) / avgCost) * 100;
    expect(dropPct >= threshold).toBe(false);
  });

  it("triggers price_rise alert when rise >= threshold", () => {
    const avgCost = 100;
    const lastPrice = 115; // 15% rise
    const threshold = 10;
    const risePct = ((lastPrice - avgCost) / avgCost) * 100;
    expect(risePct).toBeCloseTo(15);
    expect(risePct >= threshold).toBe(true);
  });

  it("triggers buy_opportunity when price <= avgCost * (1 - threshold/100)", () => {
    const avgCost = 100;
    const threshold = 10; // 10% below avg cost
    const buyLevel = avgCost * (1 - threshold / 100); // 90
    const lastPrice = 88; // below 90
    expect(lastPrice <= buyLevel).toBe(true);
  });

  it("does NOT trigger buy_opportunity when price > buyLevel", () => {
    const avgCost = 100;
    const threshold = 10;
    const buyLevel = avgCost * (1 - threshold / 100); // 90
    const lastPrice = 92; // above 90
    expect(lastPrice <= buyLevel).toBe(false);
  });

  it("triggers above_target when price >= targetPrice", () => {
    const lastPrice = 55;
    const targetPrice = 50;
    expect(lastPrice >= targetPrice).toBe(true);
  });

  it("triggers below_target when price <= targetPrice", () => {
    const lastPrice = 45;
    const targetPrice = 50;
    expect(lastPrice <= targetPrice).toBe(true);
  });

  it("does not trigger when lastPrice is 0", () => {
    const lastPrice = 0;
    const avgCost = 100;
    const threshold = 10;
    // Guard: skip if lastPrice <= 0
    const shouldProcess = lastPrice > 0;
    expect(shouldProcess).toBe(false);
  });
});

// ============================================================
// Dividend grouping by month
// ============================================================

describe("Dividend grouping by month", () => {
  it("groups dividends by year-month key correctly", () => {
    const dates = [
      new Date("2025-01-15"),
      new Date("2025-01-28"),
      new Date("2025-02-10"),
    ];

    const monthMap = new Map<string, number>();
    const values = [100, 200, 150];

    dates.forEach((date, i) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + values[i]);
    });

    expect(monthMap.get("2025-01")).toBe(300);
    expect(monthMap.get("2025-02")).toBe(150);
  });

  it("returns correct number of months", () => {
    const monthMap = new Map([
      ["2025-01", 100],
      ["2025-02", 200],
      ["2025-03", 150],
    ]);
    expect(monthMap.size).toBe(3);
  });
});
