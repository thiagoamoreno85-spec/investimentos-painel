import { describe, expect, it } from "vitest";
import { safeJsonFetch } from "./lib/safeJsonFetch";

describe("safeJsonFetch", () => {
  it("aceita resposta JSON bem-sucedida", async () => {
    const data = await safeJsonFetch<{ value: number }>("https://example.test", {
      fetcher: async () => new Response(JSON.stringify({ value: 42 }), { headers: { "content-type": "application/json" } }),
    });
    expect(data).toEqual({ value: 42 });
  });

  it("rejeita resposta HTML antes de tentar converter o conteúdo em JSON", async () => {
    await expect(safeJsonFetch("https://example.test", {
      fetcher: async () => new Response("<?xml version='1.0'?><error/>", { headers: { "content-type": "application/xml" } }),
    })).rejects.toThrow("não retornou JSON");
  });

  it("rejeita resposta HTTP sem manter a consulta em estado pendente", async () => {
    await expect(safeJsonFetch("https://example.test", {
      fetcher: async () => new Response("not found", { status: 404, headers: { "content-type": "text/plain" } }),
    })).rejects.toThrow("HTTP 404");
  });
});
