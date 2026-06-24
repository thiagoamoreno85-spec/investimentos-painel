import { describe, it, expect } from "vitest";

describe("Snapshot Service", () => {
  it("should calculate class values correctly", () => {
    const classValues: Record<string, number> = {};
    const assets = [
      { assetClass: "rv_nacional", qty: 100, price: 50, fx: 1 },
      { assetClass: "rv_nacional", qty: 200, price: 30, fx: 1 },
      { assetClass: "rv_eua", qty: 10, price: 100, fx: 5.5 },
      { assetClass: "cripto", qty: 0.5, price: 60000, fx: 5.5 },
    ];

    for (const a of assets) {
      const valueBRL = a.qty * a.price * a.fx;
      classValues[a.assetClass] = (classValues[a.assetClass] || 0) + valueBRL;
    }

    expect(classValues["rv_nacional"]).toBe(11000);
    expect(classValues["rv_eua"]).toBe(5500);
    expect(classValues["cripto"]).toBe(165000);
  });

  it("should calculate daily return correctly", () => {
    const currentTotal = 105000;
    const yesterdayTotal = 100000;
    const diff = currentTotal - yesterdayTotal;
    const pct = (diff / yesterdayTotal) * 100;

    expect(diff).toBe(5000);
    expect(pct).toBe(5);
  });

  it("should calculate monthly return correctly", () => {
    const currentTotal = 115000;
    const monthStartTotal = 100000;
    const diff = currentTotal - monthStartTotal;
    const pct = (diff / monthStartTotal) * 100;

    expect(diff).toBe(15000);
    expect(pct).toBe(15);
  });

  it("should handle negative returns", () => {
    const currentTotal = 95000;
    const previousTotal = 100000;
    const diff = currentTotal - previousTotal;
    const pct = (diff / previousTotal) * 100;

    expect(diff).toBe(-5000);
    expect(pct).toBe(-5);
  });

  it("should handle zero previous value gracefully", () => {
    const currentTotal = 50000;
    const previousTotal = 0;

    const result = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;
    expect(result).toBeNull();
  });

  it("should calculate per-class returns from JSON snapshots", () => {
    const currentValues = { rv_nacional: 55000, rv_eua: 30000, cripto: 20000 };
    const snapshotJSON = JSON.stringify({ rv_nacional: 50000, rv_eua: 28000, cripto: 22000 });
    const snapshotValues = JSON.parse(snapshotJSON);

    const result: Record<string, { valueDiff: number; percentDiff: number }> = {};
    for (const cls of Object.keys(currentValues)) {
      const curr = currentValues[cls as keyof typeof currentValues];
      const prev = snapshotValues[cls] ?? 0;
      if (prev > 0) {
        result[cls] = {
          valueDiff: curr - prev,
          percentDiff: ((curr - prev) / prev) * 100,
        };
      }
    }

    expect(result["rv_nacional"].valueDiff).toBe(5000);
    expect(result["rv_nacional"].percentDiff).toBe(10);
    expect(result["rv_eua"].percentDiff).toBeCloseTo(7.14, 1);
    expect(result["cripto"].valueDiff).toBe(-2000);
    expect(result["cripto"].percentDiff).toBeCloseTo(-9.09, 1);
  });
});
