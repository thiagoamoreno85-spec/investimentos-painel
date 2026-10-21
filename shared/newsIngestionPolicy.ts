export interface NewsIdentityInput {
  url?: string | null;
  title: string;
  source?: string | null;
}

/** Normaliza campos de identificação sem alterar o conteúdo exibido ao usuário. */
export function normalizeNewsIdentityPart(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * A URL é a identificação preferencial. Quando ela não existe, título + fonte
 * mantêm a deduplicação determinística dentro do pipeline de notícias.
 */
export function createNewsIdentityKey({ url, title, source }: NewsIdentityInput): string {
  const normalizedUrl = normalizeNewsIdentityPart(url)
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");

  if (normalizedUrl) return `url:${normalizedUrl}`;

  return `fallback:${normalizeNewsIdentityPart(source)}|${normalizeNewsIdentityPart(title)}`;
}

/** Seleciona somente itens ainda não persistidos para a análise de impacto. */
export function selectNovelNews<T extends NewsIdentityInput>(items: T[], knownFingerprints: ReadonlySet<string>, fingerprintOf: (item: T) => string): T[] {
  const seenInBatch = new Set<string>();

  return items.filter((item) => {
    const fingerprint = fingerprintOf(item);
    if (knownFingerprints.has(fingerprint) || seenInBatch.has(fingerprint)) return false;
    seenInBatch.add(fingerprint);
    return true;
  });
}
