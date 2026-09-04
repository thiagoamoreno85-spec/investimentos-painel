const NAMED_ENTITIES: Record<string, string> = {
  aacute: "á",
  acirc: "â",
  agrave: "à",
  aring: "å",
  atilde: "ã",
  auml: "ä",
  amp: "&",
  apos: "'",
  ccedil: "ç",
  copy: "©",
  eacute: "é",
  ecirc: "ê",
  egrave: "è",
  euml: "ë",
  gt: ">",
  hellip: "…",
  iacute: "í",
  icirc: "î",
  igrave: "ì",
  iuml: "ï",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  ndash: "–",
  nbsp: " ",
  ntilde: "ñ",
  oacute: "ó",
  ocirc: "ô",
  ograve: "ò",
  oslash: "ø",
  otilde: "õ",
  ouml: "ö",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  trade: "™",
  uacute: "ú",
  ucirc: "û",
  ugrave: "ù",
  uuml: "ü",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[normalized] ?? entity;
  });
}

/** Remove markup e normaliza entidades, espaços e caracteres inválidos de feeds externos. */
export function sanitizeNewsText(value: unknown): string {
  if (typeof value !== "string") return "";

  const withoutMarkup = value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return decodeEntities(decodeEntities(withoutMarkup))
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Identifica registros legados cuja codificação perdeu caracteres e não pode ser reconstruída com segurança. */
export function hasIrrecoverableNewsEncoding(value: unknown): boolean {
  return typeof value === "string" && value.includes("\uFFFD");
}

function declaredCharset(contentType: string | null, text: string): string | null {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1];
  if (fromHeader) return fromHeader;

  const fromXml = text.match(/<\?xml[^>]+encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  return fromXml ?? null;
}

/** Decodifica feeds que declaram ISO-8859-1/Windows-1252 antes da higienização do texto. */
export async function readNewsFeedText(response: Response): Promise<string> {
  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const charset = declaredCharset(response.headers.get("content-type"), utf8);
  if (!charset || /^utf-?8$/i.test(charset)) return utf8;

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return utf8;
  }
}
