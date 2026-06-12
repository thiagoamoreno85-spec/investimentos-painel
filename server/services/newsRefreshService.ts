/**
 * Serviço de atualização de notícias — compartilhado entre o tRPC mutation
 * e o endpoint Heartbeat (/api/scheduled/news-refresh).
 */
import { getDb, getAssetsByUser, createNewsItem, deleteOldNewsItems } from "../db";
import { alerts } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

/** Carteira completa do Dr. Thiago Moreno para contexto do LLM */
const PORTFOLIO_CONTEXT = `
Carteira do investidor:
- Brasil (RV): VALE3, SBSP3, CMIN3, MBRF3, TTEN3, KEPL3, CYRE3, BBAS3, AXIA6, CXSE3, AGRO3, SUZB3, BPAC11, BRAV3, SOJA3, XPML11, INBR32, BBDC4, ORVR3, FLRY3, KLBN11
- EUA (RV): PLTR (Palantir), LMT (Lockheed Martin), URNM (ETF urânio), INDA (ETF Índia)
- Cripto: BTC, ETH, SOL
- Renda Fixa: NTN-B (IPCA+8%), LFT (Selic), Prefixado 14,40%, Fundos Mauá e Valora (CRI)
`;

interface NewsItem {
  title: string;
  summary: string;
  impactAnalysis: string;
  source: string;
  sourceUrl: string;
  category: string;
  impactLevel: string;
  sentiment: string;
  priceDirection: string;
  affectedTickers: string[];
}

/** Gera notícias analisadas pela IA sobre os ativos da carteira */
export async function generateNewsWithLLM(
  userAssets: { ticker: string; name: string; assetClass: string }[]
): Promise<NewsItem[]> {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tickerList = userAssets.map((a) => a.ticker).join(", ");

  const prompt = `Você é um analista financeiro especialista em mercados brasileiro e americano. 
Hoje é ${today}.

${PORTFOLIO_CONTEXT}

Ativos reais na carteira do investidor: ${tickerList}

Gere EXATAMENTE 8 notícias financeiras relevantes e realistas para hoje, cobrindo:
- 3 notícias sobre o mercado brasileiro (macro, setorial ou específico de ativo)
- 2 notícias sobre o mercado americano (S&P500, Fed, tecnologia, defesa)
- 1 notícia sobre criptomoedas (BTC, ETH ou mercado cripto)
- 1 notícia sobre commodities/energia (petróleo, minério, urânio)
- 1 notícia macro global (Fed, juros globais, dólar, geopolítica)

Para cada notícia, analise o impacto direto nos ativos da carteira listada acima.

Responda APENAS com JSON válido no seguinte formato (sem markdown, sem texto extra):
{
  "news": [
    {
      "title": "Título conciso e informativo da notícia",
      "summary": "Resumo de 2-3 frases explicando o fato e seu contexto",
      "impactAnalysis": "Análise de 1-2 frases sobre o impacto específico nos ativos da carteira",
      "source": "Nome da fonte (ex: Bloomberg, Reuters, InfoMoney, Valor Econômico)",
      "sourceUrl": "URL plausível da notícia (ex: https://infomoney.com.br/...)",
      "category": "brasil|global|cripto|tech|politica|macro",
      "impactLevel": "alto|medio|baixo",
      "sentiment": "positivo|negativo|neutro",
      "priceDirection": "alta_forte|alta_media|alta_fraca|neutro|baixa_fraca|baixa_media|baixa_forte",
      "affectedTickers": ["TICKER1", "TICKER2"]
    }
  ]
}

Critérios de impacto:
- "alto": afeta diretamente um ativo da carteira com potencial de variação > 3%
- "medio": contexto macro relevante que pode influenciar 1-2 ativos
- "baixo": informação de fundo, tendência de longo prazo

Critérios de priceDirection (previsão de movimento de preço para os ativos afetados):
- "alta_forte": notícia muito positiva, potencial de alta > 5% no curto prazo
- "alta_media": notícia positiva, potencial de alta entre 2% e 5%
- "alta_fraca": notícia levemente positiva, potencial de alta < 2%
- "neutro": notícia sem direção clara ou impacto equilibrado
- "baixa_fraca": notícia levemente negativa, potencial de queda < 2%
- "baixa_media": notícia negativa, potencial de queda entre 2% e 5%
- "baixa_forte": notícia muito negativa, potencial de queda > 5%

Certifique-se que os affectedTickers sejam EXATAMENTE os tickers da carteira listada acima.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Você é um analista financeiro especialista. Responda APENAS com JSON válido, sem markdown.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "financial_news",
        strict: true,
        schema: {
          type: "object",
          properties: {
            news: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  impactAnalysis: { type: "string" },
                  source: { type: "string" },
                  sourceUrl: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["brasil", "global", "cripto", "tech", "politica", "macro"],
                  },
                  impactLevel: { type: "string", enum: ["alto", "medio", "baixo"] },
                  sentiment: { type: "string", enum: ["positivo", "negativo", "neutro"] },
                  priceDirection: {
                    type: "string",
                    enum: [
                      "alta_forte",
                      "alta_media",
                      "alta_fraca",
                      "neutro",
                      "baixa_fraca",
                      "baixa_media",
                      "baixa_forte",
                    ],
                  },
                  affectedTickers: { type: "array", items: { type: "string" } },
                },
                required: [
                  "title",
                  "summary",
                  "impactAnalysis",
                  "source",
                  "sourceUrl",
                  "category",
                  "impactLevel",
                  "sentiment",
                  "priceDirection",
                  "affectedTickers",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["news"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");

  let parsed: { news: NewsItem[] };
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("LLM returned invalid JSON");
  }

  if (!parsed.news || !Array.isArray(parsed.news)) {
    throw new Error("LLM response missing news array");
  }

  return parsed.news.map((item) => ({
    title: item.title || "Sem título",
    summary: item.summary || "",
    impactAnalysis: item.impactAnalysis || "",
    source: item.source || "Fonte desconhecida",
    sourceUrl: item.sourceUrl || "",
    category: item.category || "global",
    impactLevel: item.impactLevel || "baixo",
    sentiment: item.sentiment || "neutro",
    priceDirection: item.priceDirection || "neutro",
    affectedTickers: Array.isArray(item.affectedTickers) ? item.affectedTickers : [],
  }));
}

/**
 * Executa o refresh completo de notícias para um userId.
 * Compartilhado entre o tRPC mutation e o endpoint Heartbeat.
 */
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

  const assetList = userAssets.map((a) => ({
    ticker: a.ticker,
    name: a.name,
    assetClass: a.assetClass,
  }));

  const generatedNews = await generateNewsWithLLM(assetList);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const savedIds: number[] = [];
  const alertsCreated: number[] = [];

  for (const news of generatedNews) {
    const id = await createNewsItem({
      userId,
      title: news.title,
      summary: news.summary,
      impactAnalysis: news.impactAnalysis,
      source: news.source,
      sourceUrl: news.sourceUrl,
      category: news.category as "brasil" | "global" | "cripto" | "tech" | "politica" | "macro",
      impactLevel: news.impactLevel as "alto" | "medio" | "baixo",
      sentiment: news.sentiment as "positivo" | "negativo" | "neutro",
      priceDirection: news.priceDirection as
        | "alta_forte"
        | "alta_media"
        | "alta_fraca"
        | "neutro"
        | "baixa_fraca"
        | "baixa_media"
        | "baixa_forte",
      affectedTickers: JSON.stringify(news.affectedTickers),
      publishedAt: new Date(),
      isRead: 0,
    });
    savedIds.push(id);

    // Se impacto alto, criar alerta automático com direção de preço
    if (news.impactLevel === "alto") {
      const firstTicker = news.affectedTickers[0];
      if (firstTicker) {
        const affectedAsset = userAssets.find(
          (a) => a.ticker.toUpperCase() === firstTicker.toUpperCase()
        );
        if (affectedAsset) {
          try {
            const directionLabel = getPriceDirectionLabel(news.priceDirection);
            const alertResult = await db.insert(alerts).values({
              userId,
              assetId: affectedAsset.id,
              type: "news_alert",
              threshold: "0",
              status: "triggered",
              triggeredMessage: `🔴 NOTÍCIA DE ALTO IMPACTO: ${news.title}\n\n📊 Direção esperada: ${directionLabel}\n\n${news.impactAnalysis}\n\nFonte: ${news.source}`,
              triggeredAt: new Date(),
              notes: `Direção de preço: ${news.priceDirection} | Ativos afetados: ${news.affectedTickers.join(", ")}`,
            });
            alertsCreated.push(alertResult[0].insertId);
          } catch (e) {
            console.error("[NewsRefreshService] Failed to create alert:", e);
          }
        }
      }
    }
  }

  // Limpar notícias antigas (manter apenas as 100 mais recentes)
  await deleteOldNewsItems(userId, 100);

  return {
    count: savedIds.length,
    alertsCreated: alertsCreated.length,
    message: `${savedIds.length} notícias geradas com análise de impacto. ${alertsCreated.length} alertas de alto impacto criados.`,
  };
}

/** Converte o código de direção para texto legível */
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
