import { describe, expect, it } from "vitest";
import { buildClosedPerformanceHistory } from "../shared/closedPerformanceHistory";

describe("buildClosedPerformanceHistory", () => {
  it("compõe retornos por fechamento e conserva apenas o último ponto mensal", () => {
    const result = buildClosedPerformanceHistory([
      { date: "2026-10-01", returnPct: 1 },
      { date: "2026-10-02", returnPct: 2 },
      { date: "2026-11-03", returnPct: -1 },
    ]);

    expect(result.fromDate).toBe("2026-10-01");
    expect(result.lastClosedDate).toBe("2026-11-03");
    expect(result.snapshotCount).toBe(3);
    expect(result.history).toEqual([
      { date: "2026-10", value: 3.02 },
      { date: "2026-11", value: 1.9898 },
    ]);
  });

  it("não cria pontos quando não existem fechamentos persistidos", () => {
    expect(buildClosedPerformanceHistory([])).toEqual({
      fromDate: null,
      lastClosedDate: null,
      snapshotCount: 0,
      history: [],
    });
  });
});
