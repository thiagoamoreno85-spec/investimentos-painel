import { describe, expect, it } from "vitest";
import { selectDistinctAlertFeed } from "../shared/newsAlertFeed";

describe("selectDistinctAlertFeed", () => {
  it("preserva o alerta mais recente de uma mesma notícia para o mesmo ativo", () => {
    const items = selectDistinctAlertFeed([
      { id: 22, assetId: 7, type: "news_alert", sourceNewsId: 9 },
      { id: 21, assetId: 7, type: "news_alert", sourceNewsId: 9 },
    ]);

    expect(items.map((item) => item.id)).toEqual([22]);
  });

  it("mantém alertas da mesma notícia destinados a ativos diferentes", () => {
    const items = selectDistinctAlertFeed([
      { id: 22, assetId: 7, type: "news_alert", sourceNewsId: 9 },
      { id: 21, assetId: 8, type: "news_alert", sourceNewsId: 9 },
    ]);

    expect(items.map((item) => item.id)).toEqual([22, 21]);
  });

  it("deduplica alertas legados pela mensagem normalizada", () => {
    const items = selectDistinctAlertFeed([
      { id: 22, assetId: 7, type: "news_alert", triggeredMessage: "Notícia de juros" },
      { id: 21, assetId: 7, type: "news_alert", triggeredMessage: " notícia  de JUROS " },
    ]);

    expect(items.map((item) => item.id)).toEqual([22]);
  });

  it("não oculta alertas manuais", () => {
    const items = selectDistinctAlertFeed([
      { id: 22, assetId: 7, type: "price_drop", triggeredMessage: "Queda" },
      { id: 21, assetId: 7, type: "price_drop", triggeredMessage: "Queda" },
    ]);

    expect(items.map((item) => item.id)).toEqual([22, 21]);
  });
});
