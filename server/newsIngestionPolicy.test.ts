import { describe, expect, it } from "vitest";
import { createNewsIdentityKey, selectNovelNews } from "../shared/newsIngestionPolicy";

describe("news ingestion policy", () => {
  it("normaliza URLs antes de gerar a identidade", () => {
    expect(createNewsIdentityKey({
      title: "Ignorado quando há URL",
      source: "Fonte",
      url: " HTTPS://EXEMPLO.COM/Materia/?utm_source=rss#top ",
    })).toBe("url:https://exemplo.com/materia");
  });

  it("usa título e fonte quando o feed não fornece URL", () => {
    expect(createNewsIdentityKey({
      title: "Mercado sobe após decisão do Copom",
      source: "Fonte Econômica",
    })).toBe("fallback:fonte economica|mercado sobe apos decisao do copom");
  });

  it("remove duplicidades já persistidas e repetidas no mesmo lote", () => {
    const rows = [
      { title: "A", source: "S", url: "https://a.com/1" },
      { title: "A repetida", source: "S", url: "https://a.com/1?utm=x" },
      { title: "B", source: "S", url: "https://b.com/2" },
    ];
    const fingerprints = rows.map((item) => createNewsIdentityKey(item));

    const result = selectNovelNews(rows, new Set([fingerprints[2]]), (item) => createNewsIdentityKey(item));

    expect(result).toEqual([rows[0]]);
  });
});
