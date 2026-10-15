import { describe, expect, it } from "vitest";
import { parseB3InvestorFlows, parseEwzFundMetrics } from "./services/marketFlowService";

describe("fontes do monitoramento de fluxos", () => {
  it("extrai a série JSON da B3 sem depender do ponto e vírgula final", () => {
    const rows = parseB3InvestorFlows(`
      <script>
        const data = [{"date":"2026-10-13","foreigners":2075812,"institutional":-2206585,"individuals":381287,"financial_institutions":-137028,"other":-113484}]
        renderChart(data)
      </script>
    `);

    expect(rows).toEqual([{
      date: "2026-10-13",
      foreigners: 2_075_812,
      institutional: -2_206_585,
      individuals: 381_287,
      financialInstitutions: -137_028,
      other: -113_484,
    }]);
  });

  it("extrai cotas, patrimônio e NAV publicados pela iShares", () => {
    const metrics = parseEwzFundMetrics(`
      &quot;sharesOutstanding&quot;:{&quot;formattedValue&quot;:&quot;312,350,000&quot;,&quot;formattedAsOfDate&quot;:&quot;Oct 14, 2026&quot;}
      &quot;totalNetAssetsFundLevel&quot;:{&quot;formattedValue&quot;:&quot;13,275,134,596&quot;,&quot;formattedAsOfDate&quot;:&quot;Oct 14, 2026&quot;}
      &quot;navAmount&quot;:{&quot;formattedValue&quot;:&quot;42.50&quot;,&quot;formattedAsOfDate&quot;:&quot;Oct 14, 2026&quot;}
    `);

    expect(metrics).toEqual({
      sharesOutstanding: 312_350_000,
      netAssetsUsd: 13_275_134_596,
      navUsd: 42.5,
      asOf: "Oct 14, 2026",
    });
  });
});
