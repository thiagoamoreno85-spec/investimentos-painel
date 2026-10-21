import { describe, expect, it } from "vitest";
import { isOfficialPerformanceClose } from "../shared/closedPerformanceSnapshot";

describe("isOfficialPerformanceClose", () => {
  it("aceita fechamento pós-mercado valorizado e capturado no próprio dia", () => {
    expect(isOfficialPerformanceClose({
      snapshotDate: "2026-10-21",
      status: "final",
      capturedAt: "2026-10-21T21:00:00-03:00",
      valuationAsOf: "2026-10-21T21:00:00-03:00",
    })).toBe(true);
  });

  it("rejeita lançamento retroativo mesmo que esteja rotulado como final", () => {
    expect(isOfficialPerformanceClose({
      snapshotDate: "2026-10-12",
      status: "final",
      capturedAt: "2026-10-21T15:51:21.000Z",
      valuationAsOf: null,
    })).toBe(false);
  });

  it("rejeita captura intradiária da série mensal oficial", () => {
    expect(isOfficialPerformanceClose({
      snapshotDate: "2026-10-21",
      status: "intraday",
      capturedAt: "2026-10-21T15:51:21.000Z",
      valuationAsOf: "2026-10-21T15:51:21.000Z",
    })).toBe(false);
  });
});
