import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAssetsByUser,
  createNewsItem,
  getNewsItemsByUser,
  markNewsItemRead,
  markAllNewsRead,
  countUnreadNews,
  deleteOldNewsItems,
} from "../db";
import { getDb } from "../db";
import { alerts, newsItems } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

/** Carteira completa do Dr. Thiago Moreno para contexto do LLM */
const PORTFOLIO_CONTEXT = `
Carteira do investidor:
- Brasil (RV): VALE3, SBSP3, CMIN3, MBRF3, TTEN3, KEPL3, CYRE3, BBAS3, AXIA6, CXSE3, AGRO3, SUZB3, BPAC11, BRAV3, SOJA3, XPML11, INBR32, BBDC4, ORVR3, FLRY3, KLBN11
- EUA (RV): PLTR (Palantir), LMT (Lockheed Martin), URNM (ETF urânio), INDA (ETF Índia)
- Cripto: BTC, ETH, SOL
- Renda Fixa: NTN-B (IPCA+8%), LFT (Selic), Prefixado 14,40%, Fundos Mauá e Valora (CRI)
`;

/** Gera notícias analisadas pela IA sobre os ativos da carteira */
async function generateNewsWithLLM(userAssets: { ticker: string; name: string; assetClass: string }[]) {
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
      "sourceUrl": "https://www.exemplo.com/noticia (URL plausível mas pode ser fictícia)",
      "category": "brasil|global|cripto|tech|politica|macro",
      "impactLevel": "alto|medio|baixo",
      "sentiment": "positivo|negativo|neutro",
      "affectedTickers": ["TICKER1", "TICKER2"]
    }
  ]
}

Regras:
- impactLevel "alto" apenas para eventos que movem >3% o ativo
- affectedTickers deve conter apenas tickers que realmente estão na carteira do investidor
- sentiment reflete o impacto para o INVESTIDOR (positivo = bom para a carteira)
- Seja realista e baseado em tendências atuais do mercado`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Você é um analista financeiro sênior especialista em mercados brasileiro e americano. Sempre responda com JSON válido e bem formatado.",
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
                  impactLevel: {
                    type: "string",
                    enum: ["alto", "medio", "baixo"],
                  },
                  sentiment: {
                    type: "string",
                    enum: ["positivo", "negativo", "neutro"],
                  },
                  affectedTickers: {
                    type: "array",
                    items: { type: "string" },
                  },
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

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");

  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return parsed.news as Array<{
    title: string;
    summary: string;
    impactAnalysis: string;
    source: string;
    sourceUrl: string;
    category: "brasil" | "global" | "cripto" | "tech" | "politica" | "macro";
    impactLevel: "alto" | "medio" | "baixo";
    sentiment: "positivo" | "negativo" | "neutro";
    affectedTickers: string[];
  }>;
}

export const newsRouter = router({
  /**
   * Listar notícias do usuário com filtros opcionais
   */
  list: protectedProcedure
    .input(
      z
        .object({
          category: z
            .enum(["brasil", "global", "cripto", "tech", "politica", "macro", "all"])
            .default("all"),
          impactLevel: z.enum(["alto", "medio", "baixo", "all"]).default("all"),
          onlyUnread: z.boolean().default(false),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit ?? 50;
      const rows = await getNewsItemsByUser(userId, limit);

      let filtered = rows;

      if (input?.category && input.category !== "all") {
        filtered = filtered.filter((r) => r.category === input.category);
      }
      if (input?.impactLevel && input.impactLevel !== "all") {
        filtered = filtered.filter((r) => r.impactLevel === input.impactLevel);
      }
      if (input?.onlyUnread) {
        filtered = filtered.filter((r) => r.isRead === 0);
      }

      return filtered.map((r) => ({
        ...r,
        affectedTickers: r.affectedTickers ? JSON.parse(r.affectedTickers) : [],
      }));
    }),

  /**
   * Contar notícias não lidas
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return countUnreadNews(ctx.user.id);
  }),

  /**
   * Buscar e analisar novas notícias via LLM
   */
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userAssets = await getAssetsByUser(userId);

    if (userAssets.length === 0) {
      throw new Error("Carteira vazia. Importe seus ativos primeiro.");
    }

    const assetList = userAssets.map((a) => ({
      ticker: a.ticker,
      name: a.name,
      assetClass: a.assetClass,
    }));

    // Gerar notícias via LLM
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
        category: news.category,
        impactLevel: news.impactLevel,
        sentiment: news.sentiment,
        affectedTickers: JSON.stringify(news.affectedTickers),
        publishedAt: new Date(),
        isRead: 0,
      });
      savedIds.push(id);

      // Se impacto alto, criar alerta automático
      if (news.impactLevel === "alto") {
        // Buscar o primeiro ativo afetado para vincular ao alerta
        const firstTicker = news.affectedTickers[0];
        if (firstTicker) {
          const affectedAsset = userAssets.find(
            (a) => a.ticker.toUpperCase() === firstTicker.toUpperCase()
          );
          if (affectedAsset) {
            try {
              const alertResult = await db.insert(alerts).values({
                userId,
                assetId: affectedAsset.id,
                type: "news_alert",
                threshold: "0",
                status: "triggered",
                triggeredMessage: `🔴 NOTÍCIA DE ALTO IMPACTO: ${news.title}\n\n${news.impactAnalysis}\n\nFonte: ${news.source}`,
                triggeredAt: new Date(),
                notes: `Gerado automaticamente pela análise de notícias. Ativos afetados: ${news.affectedTickers.join(", ")}`,
              });
              alertsCreated.push(alertResult[0].insertId);
            } catch (e) {
              console.error("[NewsRouter] Failed to create alert:", e);
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
  }),

  /**
   * Marcar uma notícia como lida
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNewsItemRead(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Marcar todas as notícias como lidas
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNewsRead(ctx.user.id);
    return { success: true };
  }),
});
