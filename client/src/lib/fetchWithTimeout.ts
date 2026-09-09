type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Combina um cancelamento externo com um prazo local sem depender de
 * AbortSignal.timeout/AbortSignal.any, que não são consistentes em browsers antigos.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs = 15_000,
  fetcher: Fetcher = globalThis.fetch.bind(globalThis),
): Promise<Response> {
  if (typeof AbortController === "undefined") {
    return fetcher(input, init);
  }

  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}
