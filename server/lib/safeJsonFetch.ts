export type JsonFetchOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

/** Busca JSON com prazo explícito e validação básica da resposta HTTP. */
export async function safeJsonFetch<T>(url: string, options: JsonFetchOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const response = await (options.fetcher ?? fetch)(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Fonte externa respondeu HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const excerpt = (await response.text()).replace(/\s+/g, " ").slice(0, 80);
    throw new Error(`Fonte externa não retornou JSON${excerpt ? `: ${excerpt}` : ""}`);
  }

  return response.json() as Promise<T>;
}
