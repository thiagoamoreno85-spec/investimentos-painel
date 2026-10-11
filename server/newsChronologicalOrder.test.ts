import { describe, expect, it } from "vitest";
import { sortNewsByPublicationDate } from "../shared/newsChronologicalOrder";

describe("sortNewsByPublicationDate", () => {
  it("prioriza a publicação mais recente mesmo que tenha sido incluída antes", () => {
    const items = [
      { id: 1, publishedAt: new Date("2026-10-10T09:00:00Z"), createdAt: new Date("2026-10-11T12:00:00Z") },
      { id: 2, publishedAt: new Date("2026-10-11T11:00:00Z"), createdAt: new Date("2026-10-11T11:05:00Z") },
    ];

    expect(sortNewsByPublicationDate(items).map((item) => item.id)).toEqual([2, 1]);
  });

  it("usa inclusão como fallback quando a fonte não informa publicação", () => {
    const items = [
      { id: 1, publishedAt: null, createdAt: new Date("2026-10-11T08:00:00Z") },
      { id: 2, publishedAt: null, createdAt: new Date("2026-10-11T10:00:00Z") },
    ];

    expect(sortNewsByPublicationDate(items).map((item) => item.id)).toEqual([2, 1]);
  });

  it("mantém resultado determinístico em empate de datas", () => {
    const timestamp = new Date("2026-10-11T10:00:00Z");
    const items = [
      { id: 1, publishedAt: timestamp, createdAt: timestamp },
      { id: 2, publishedAt: timestamp, createdAt: timestamp },
    ];

    expect(sortNewsByPublicationDate(items).map((item) => item.id)).toEqual([2, 1]);
  });
});
