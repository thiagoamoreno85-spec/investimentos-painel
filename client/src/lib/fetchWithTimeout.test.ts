import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetchWithTimeout";

describe("fetchWithTimeout", () => {
  it("preserva credenciais e encaminha o cancelamento externo", async () => {
    const externalController = new AbortController();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("include");
      expect(init?.signal).toBeDefined();
      return new Response("ok", { status: 200 });
    });

    const response = await fetchWithTimeout(
      "/api/trpc",
      { credentials: "include", signal: externalController.signal },
      1_000,
      fetcher,
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("interrompe a requisição quando o prazo expira", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("abortado")));
      }),
    );

    const request = fetchWithTimeout("/api/trpc", undefined, 500, fetcher);
    await vi.advanceTimersByTimeAsync(500);

    await expect(request).rejects.toThrow("abortado");
    vi.useRealTimers();
  });
});
