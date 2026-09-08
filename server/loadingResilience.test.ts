import { describe, expect, it } from "vitest";
import { safeJsonFetch } from "./lib/safeJsonFetch";

describe("resiliência de consultas externas", () => {
  it("rejeita imediatamente conteúdo XML, em vez de deixá-lo bloquear uma consulta de benchmark", async () => {
    await expect(safeJsonFetch("https://source.test", {
      fetcher: async () => new Response("<?xml version='1.0'?><response/>", {
        headers: { "content-type": "text/xml" },
      }),
    })).rejects.toThrow("não retornou JSON");
  });
});
