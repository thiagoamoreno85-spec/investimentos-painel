import { describe, expect, it } from "vitest";
import { filterMarketAssetsByClass, isMarketAssetTab, MARKET_ASSET_TABS } from "../shared/marketAssetTabs";

describe("market asset tabs", () => {
  it("mantém as classes de ativo previstas na navegação de mercado", () => {
    expect(MARKET_ASSET_TABS.map((tab) => tab.id)).toEqual([
      "rv_nacional",
      "fundos",
      "rv_eua",
      "cripto",
      "renda_fixa",
      "uranio",
      "india",
      "caixa",
    ]);
    expect(isMarketAssetTab("rv_eua")).toBe(true);
    expect(isMarketAssetTab("outros")).toBe(false);
  });

  it("mostra apenas os ativos da classe ativa sem alterar sua ordem", () => {
    const assets = [
      { ticker: "VALE3", assetClass: "rv_nacional" },
      { ticker: "MSFT", assetClass: "rv_eua" },
      { ticker: "PETR4", assetClass: "rv_nacional" },
    ];

    expect(filterMarketAssetsByClass(assets, "rv_nacional").map((asset) => asset.ticker)).toEqual(["VALE3", "PETR4"]);
  });
});
