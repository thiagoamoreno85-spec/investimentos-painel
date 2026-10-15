import { describe, expect, it } from "vitest";
import { aggregateMarketFlows } from "../shared/marketFlowPeriod";

const history = [
  {
    snapshotDate: "2026-07-01",
    b3ReportedThrough: "2026-07-01",
    b3ForeignFlowBrl: 100,
    b3DomesticFlowBrl: -100,
    ewzFlowProxyUsd: 10,
  },
  {
    snapshotDate: "2026-07-03",
    b3ReportedThrough: "2026-07-03",
    b3ForeignFlowBrl: -40,
    b3DomesticFlowBrl: 40,
    ewzFlowProxyUsd: -5,
  },
  {
    snapshotDate: "2026-07-06",
    b3ReportedThrough: "2026-07-03",
    b3ForeignFlowBrl: -40,
    b3DomesticFlowBrl: 40,
    ewzFlowProxyUsd: 8,
  },
  {
    snapshotDate: "2026-08-04",
    b3ReportedThrough: "2026-08-04",
    b3ForeignFlowBrl: 200,
    b3DomesticFlowBrl: -200,
    ewzFlowProxyUsd: null,
  },
  {
    snapshotDate: "2026-10-01",
    b3ReportedThrough: "2026-10-01",
    b3ForeignFlowBrl: 300,
    b3DomesticFlowBrl: -300,
    ewzFlowProxyUsd: 15,
  },
];

describe("aggregateMarketFlows", () => {
  it("mantém a periodicidade diária e não duplica pregão B3 divulgado", () => {
    const rows = aggregateMarketFlows(history, "daily");
    const julyThird = rows.find((row) => row.key === "2026-07-03");

    expect(julyThird).toMatchObject({
      b3Foreign: -40,
      b3Domestic: 40,
      b3Sessions: 1,
    });
    expect(rows.find((row) => row.key === "2026-07-06")).toMatchObject({
      b3Sessions: 0,
      ewzProxy: 8,
    });
  });

  it("soma B3 e EWZ por mês sem misturar unidades", () => {
    const rows = aggregateMarketFlows(history, "monthly");

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "2026-07-01",
        b3Foreign: 60,
        b3Domestic: -60,
        b3Sessions: 2,
        ewzProxy: 13,
        ewzObservations: 3,
      }),
      expect.objectContaining({
        key: "2026-10-01",
        b3Foreign: 300,
        b3Domestic: -300,
        ewzProxy: 15,
      }),
    ]));
  });

  it("consolida corretamente por semana, trimestre, semestre e ano", () => {
    expect(aggregateMarketFlows(history, "weekly")).toHaveLength(4);
    expect(aggregateMarketFlows(history, "quarterly")).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "2026-07-01", b3Foreign: 260, ewzProxy: 13 }),
      expect.objectContaining({ key: "2026-10-01", b3Foreign: 300, ewzProxy: 15 }),
    ]));
    expect(aggregateMarketFlows(history, "semiannual")).toEqual([
      expect.objectContaining({ key: "2026-07-01", b3Foreign: 560, ewzProxy: 28 }),
    ]);
    expect(aggregateMarketFlows(history, "annual")).toEqual([
      expect.objectContaining({ key: "2026", b3Foreign: 560, ewzProxy: 28 }),
    ]);
  });
});
