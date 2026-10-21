/**
 * Serviço de atualização de notícias — busca notícias REAIS via RSS
 * e usa LLM apenas para análise de impacto na carteira.
 */
import { createHash } from "node:crypto";
import { getDb, getAssetsByUser, createNewsItem, deleteOldNewsItems, getKnownNewsFingerprints } from "../db";
import { alerts } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { readNewsFeedText, sanitizeNewsText } from "./newsText";
import { createNewsIdentityKey, selectNovelNews } from "../../shared/newsIngestionPolicy";

// ─── Busca de notícias reais via RSS ─────────────────────────────────────────

interface RawNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
}

function createNewsFingerprint(item: RawNewsItem) {
  return createHash("sha256")
    .update(createNewsIdentityKey({ url: item.url, title: item.title, source: item.source }))
    .digest("hex");
}

const RSS_FEEDS = [
  { url: "https://www.infomoney.com.br/feed/", source: "InfoMoney", category: "brasil" },
  { url: "https://feeds.folha.uol.com.br/mercado/rss091.xml", source: "Folha Mercado", category: "brasil" },
  { url: "https://br.investing.com/rss/news.rss", source: "Investing.com BR", category: "brasil" },
  { url: "https://news.google.com/rss/search?q=mercado+financeiro+Brasil+investimentos&hl=pt-BR&gl=BR&ceid=BR:pt-419", source: "Google News BR", category: "brasil" },
  { url: "https://news.google.com/rss/search?q=bitcoin+ethereum+crypto&hl=pt-BR&gl=BR&ceid=BR:pt-419", source: "Google News Crypto", category: "cripto" },
  { url: "https://news.google.com/rss/search?q=S%26P500+Fed+Wall+Street&hl=en-US&gl=US&ceid=US:en", source: "Google News US", category: "global" },
];

async function fetchRSSFeed(feedUrl: string, source: string, maxItems: number = 5): Promise<RawNewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InvestimentosPainel/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const text = await readNewsFeedText(res);

    if (feedUrl.includes("rss.app") || text.trim().startsWith("{")) {
      return parseJsonFeed(text, source, maxItems);
    }
    return parseXmlRss(text, source, maxItems);
  } catch (err) {
    console.error(`[NewsRefresh] RSS fetch error for ${source}:`, err);
    return [];
  }
}

function parseXmlRss(xml: string, source: string, maxItems: number): RawNewsItem[] {
  const items: RawNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const description = extractTag(block, "description");
    const itemSource = extractTag(block, "source") || source;

    if (!title || !link) continue;

    items.push({
      title: sanitizeNewsText(title),
      url: link,
      source: sanitizeNewsText(itemSource),
      publishedAt: pubDate || new Date().toISOString(),
      summary: sanitizeNewsText(description).substring(0, 300),
    });
  }
  return items;
}

function parseJsonFeed(json: string, source: string, maxItems: number): RawNewsItem[] {
  try {
    const data = JSON.parse(json);
    const entries = data.items || data.entries || [];
    return entries.slice(0, maxItems).map((item: any) => ({
      title: sanitizeNewsText(item.title),
      url: item.url || item.link || "",
      source: sanitizeNewsText(item.author?.name || source),
      publishedAt: item.date_published || item.pubDate || new Date().toISOString(),
      summary: sanitizeNewsText(item.content_text || item.summary || "").substring(0, 300),
    }));
  } catch {
    return [];
  }
}

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  const simpleRegex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "is");
  const simpleMatch = simpleRegex.exec(xml);
  return simpleMatch ? simpleMatch[1] : "";
}

async function fetchAllRealNews(): Promise<RawNewsItem[]> {
  const results = await Promise.all(
    RSS_FEEDS.map((feed) => fetchRSSFeed(feed.url, feed.source))
  );

  const allNews = results.flat();

  const unique = selectNovelNews(allNews, new Set<string>(), createNewsFingerprint);

  return unique
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 15);
}

// ─── Análise via LLM ────────────────────────────────────────────────────────

interface AnalyzedNews {
  originalIndex: number;
  category: string;
  impactLevel: string;
  sentiment: string;
  priceDirection: string;
  impactAnalysis: string;
  affectedTickers: string[];
}

async function analyzeNewsWithLLM(
  realNews: RawNewsItem[],
  userTickers: string[]
): Promise<AnalyzedNews[]> {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const newsListText = realNews
    .map((n, i) => `[${i}] "${n.title}" — ${n.source}\n    ${n.summary}`)
    .join("\n\n");

  const prompt = `Você é um analista financeiro especialista em mercados brasileiro e americano.
Hoje é ${today}.

Ativos na carteira do investidor: ${userTickers.join(", ")}

Abaixo estão ${realNews.length} notícias REAIS publicadas hoje. Para cada uma, analise o impacto nos ativos da carteira.

${newsListText}

Responda APENAS com JSON válido no seguinte formato (sem markdown, sem texto extra):
{
  "analyses": [
    {
      "originalIndex": 0,
      "category": "brasil|global|cripto|tech|politica|macro",
      "impactLevel": "alto|medio|baixo",
      "sentiment": "positivo|negativo|neutro",
      "priceDirection": "alta_forte|alta_media|alta_fraca|neutro|baixa_fraca|baixa_media|baixa_forte",
      "impactAnalysis": "Análise de 1-2 frases sobre o impacto específico nos ativos da carteira",
      "affectedTickers": ["TICKER1", "TICKER2"]
    }
  ]
}

Critérios de impacto:
- "alto": afeta diretamente um ativo da carteira com potencial de variação > 3%
- "medio": contexto macro relevante que pode influenciar 1-2 ativos
- "baixo": informação de fundo, tendência de longo prazo

Os affectedTickers DEVEM ser tickers reais da carteira listada acima. Se a notícia não afeta nenhum, use array vazio.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Você é um analista financeiro especialista. Responda APENAS com JSON válido, sem markdown.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "news_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            analyses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  originalIndex: { type: "number" },
                  category: {
                    type: "string",
                    enum: ["brasil", "global", "cripto", "tech", "politica", "macro"],
                  },
                  impactLevel: { type: "string", enum: ["alto", "medio", "baixo"] },
                  sentiment: { type: "string", enum: ["positivo", "negativo", "neutro"] },
                  priceDirection: {
                    type: "string",
                    enum: ["alta_forte", "alta_media", "alta_fraca", "neutro", "baixa_fraca", "baixa_media", "baixa_forte"],
                  },
                  impactAnalysis: { type: "string" },
                  affectedTickers: { type: "array", items: { type: "string" } },
                },
                required: ["originalIndex", "category", "impactLevel", "sentiment", "priceDirection", "impactAnalysis", "affectedTickers"],
                additionalProperties: false,
              },
            },
          },
          required: ["analyses"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");

  let parsed: { analyses: AnalyzedNews[] };
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("LLM returned invalid JSON for news analysis");
  }

  return parsed.analyses || [];
}

// ─── Orquestração ────────────────────────────────────────────────────────────

export async function runNewsRefresh(userId: number): Promise<{
  count: number;
  alertsCreated: number;
  message: string;
}> {
  const userAssets = await getAssetsByUser(userId);

  if (userAssets.length === 0) {
    return {
      count: 0,
      alertsCreated: 0,
      message: "Carteira vazia — nenhuma notícia gerada.",
    };
  }

  // 1) Buscar notícias reais via RSS
  const realNews = await fetchAllRealNews();
  if (realNews.length === 0) {
    return {
      count: 0,
      alertsCreated: 0,
      message: "Nenhuma notícia encontrada nos feeds RSS.",
    };
  }

  // 2) Não reanalisa conteúdo já persistido: URL é preferida, título + fonte é o fallback.
  const candidateFingerprints = realNews.map(createNewsFingerprint);
  const knownFingerprints = await getKnownNewsFingerprints(userId, candidateFingerprints);
  const newsToAnalyze = selectNovelNews(realNews, knownFingerprints, createNewsFingerprint);
  if (newsToAnalyze.length === 0) {
    return {
      count: 0,
      alertsCreated: 0,
      message: "As notícias mais recentes já foram analisadas; nenhuma duplicidade foi criada.",
    };
  }

  // 3) Analisar impacto via LLM somente para conteúdo novo.
  const tickers = userAssets.map((a) => a.ticker);
  const analyses = await analyzeNewsWithLLM(newsToAnalyze, tickers);

  // 4) Salvar no banco combinando dados reais + análise IA.
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const savedIds: number[] = [];
  const alertsCreated: number[] = [];
  const analysesByOriginalIndex = new Map(
    analyses
      .filter((analysis) => Number.isInteger(analysis.originalIndex) && analysis.originalIndex >= 0 && analysis.originalIndex < newsToAnalyze.length)
      .map((analysis) => [analysis.originalIndex, analysis]),
  );

  for (let originalIndex = 0; originalIndex < newsToAnalyze.length; originalIndex += 1) {
    const original = newsToAnalyze[originalIndex];
    const analysis = analysesByOriginalIndex.get(originalIndex) ?? {
      originalIndex,
      category: "macro",
      impactLevel: "baixo",
      sentiment: "neutro",
      priceDirection: "neutro",
      impactAnalysis: "Sem impacto direto identificado nos ativos monitorados.",
      affectedTickers: [],
    };

    const id = await createNewsItem({
      userId,
      title: original.title,
      summary: original.summary,
      impactAnalysis: analysis.impactAnalysis,
      source: original.source,
      sourceUrl: original.url,
      contentFingerprint: createNewsFingerprint(original),
      category: analysis.category as any,
      impactLevel: analysis.impactLevel as any,
      sentiment: analysis.sentiment as any,
      priceDirection: analysis.priceDirection as any,
      affectedTickers: JSON.stringify(analysis.affectedTickers),
      publishedAt: new Date(original.publishedAt),
      isRead: 0,
    });
    savedIds.push(id);

    // Se impacto alto, criar um alerta por ativo afetado e associar cada alerta à notícia.
    if (analysis.impactLevel === "alto") {
      const affectedTickers = new Set(analysis.affectedTickers.map((ticker) => ticker.toUpperCase()));
      const affectedAssets = userAssets.filter((asset) => affectedTickers.has(asset.ticker.toUpperCase()));

      for (const affectedAsset of affectedAssets) {
        try {
          const directionLabel = getPriceDirectionLabel(analysis.priceDirection);
          await db.insert(alerts).values({
            userId,
            assetId: affectedAsset.id,
            sourceNewsId: id,
            type: "news_alert",
            threshold: "0",
            status: "triggered",
            triggeredMessage: `🔴 NOTÍCIA DE ALTO IMPACTO: ${original.title}\n\n📊 Direção esperada: ${directionLabel}\n\n${analysis.impactAnalysis}\n\nFonte: ${original.source}`,
            triggeredAt: new Date(),
            notes: `Direção de preço: ${analysis.priceDirection} | Ativos afetados: ${analysis.affectedTickers.join(", ")}`,
          });
          alertsCreated.push(id);
        } catch (e) {
          console.error("[NewsRefreshService] Failed to create alert:", e);
        }
      }
    }
  }

  // Limpar notícias antigas (manter apenas as 100 mais recentes)
  await deleteOldNewsItems(userId, 100);

  return {
    count: savedIds.length,
    alertsCreated: alertsCreated.length,
    message: `${savedIds.length} notícias novas analisadas. ${alertsCreated.length} alertas de alto impacto vinculados às respectivas notícias.`,
  };
}

function getPriceDirectionLabel(direction: string): string {
  const labels: Record<string, string> = {
    alta_forte: "🟢⬆️ Alta Forte (>5%)",
    alta_media: "🟢↗️ Alta Média (2-5%)",
    alta_fraca: "🟡↗️ Alta Fraca (<2%)",
    neutro: "⚪ Neutro",
    baixa_fraca: "🟡↘️ Baixa Fraca (<2%)",
    baixa_media: "🔴↘️ Baixa Média (2-5%)",
    baixa_forte: "🔴⬇️ Baixa Forte (>5%)",
  };
  return labels[direction] ?? "⚪ Neutro";
}
