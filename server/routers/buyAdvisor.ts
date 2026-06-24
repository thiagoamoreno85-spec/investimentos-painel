import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getAssetsByUser,
  createAnalysisHistory,
  getAnalysisHistoryByUser,
  getAnalysisHistoryById,
  deleteAnalysisHistory,
  getDb,
} from "../db";
import { fetchQuotes, fetchUsdBrl } from "../quotes";
import { DEFAULT_USD_BRL_RATE } from "../../shared/constants";
import { invokeLLM } from "../_core/llm";
import { analysisHistory } from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

/** Tenta extrair o ticker recomendado do texto da análise */
function extractRecommendedTicker(text: string): string | null {
  // Padrões comuns: **SBSP3**, SBSP3 é, comprar SBSP3, VALE3:
  const patterns = [
    /\*\*([A-Z]{3,6}[0-9]{1,2})\*\*/,   // **SBSP3**
    /comprar?\s+([A-Z]{3,6}[0-9]{1,2})/i,
    /recomend[ao]\w*\s+([A-Z]{3,6}[0-9]{1,2})/i,
    /ativo[:\s]+([A-Z]{3,6}[0-9]{1,2})/i,
    /([A-Z]{3,6}[0-9]{1,2})\s+é a melhor/i,
    /([A-Z]{3,6}[0-9]{1,2})\s+—\s+\*\*RECOMENDA/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

export const buyAdvisorRouter = router({
  /**
   * Analisa a carteira do usuário e recomenda qual ativo comprar.
   * Salva automaticamente o resultado no histórico.
   */
  analyze: protectedProcedure
    .input(
      z.object({
        availableAmount: z.number().positive(),
        focus: z.enum(["brasil", "eua", "todos"]).default("brasil"),
        userContext: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cache TTL: 10 minutos
      const CACHE_TTL_MS = 10 * 60 * 1000;
      const now = new Date();

      // Buscar análise recente com os mesmos parâmetros
      const db = await getDb();
      if (db) {
        const recent = await db
          .select()
          .from(analysisHistory)
          .where(
            and(
              eq(analysisHistory.userId, ctx.user.id),
              eq(analysisHistory.focus, input.focus),
              gte(analysisHistory.createdAt, new Date(now.getTime() - CACHE_TTL_MS))
            )
          )
          .orderBy(desc(analysisHistory.createdAt))
          .limit(1);

        if (recent.length > 0) {
          const cached = recent[0];
          return {
            analysis: cached.analysisText,
            updatedAt: cached.createdAt,
            quotesSnapshot: JSON.parse(cached.quotesSnapshot || "{}"),
            usdBrl: parseFloat(cached.usdBrl || String(DEFAULT_USD_BRL_RATE)),
            assetsAnalyzed: cached.assetsAnalyzed ?? undefined,
            recommendedTicker: cached.recommendedTicker ?? undefined,
            historyId: cached.id ?? undefined,
            fromCache: true,
            message: "Retornando análise recente (menos de 10 minutos).",
          };
        }
      }

      const assets = await getAssetsByUser(ctx.user.id);

      if (assets.length === 0) {
        return {
          analysis: "Sua carteira está vazia. Importe seus ativos primeiro na página de Transações.",
          updatedAt: new Date(),
          quotesSnapshot: {},
          historyId: null,
        };
      }

      const filteredAssets = assets.filter((a) => {
        if (input.focus === "brasil") return ["rv_nacional", "fundos", "renda_fixa", "caixa"].includes(a.assetClass);
        if (input.focus === "eua") return a.assetClass === "rv_eua";
        return true;
      });

      if (filteredAssets.length === 0) {
        return {
          analysis: `Nenhum ativo encontrado para o foco "${input.focus}". Verifique sua carteira.`,
          updatedAt: new Date(),
          quotesSnapshot: {},
          historyId: null,
        };
      }

      const tickerList = filteredAssets.map((a) => ({
        ticker: a.ticker,
        assetClass: a.assetClass,
      }));

      let quotes: Map<string, { price: number; change: number; changePercent: number; currency: string }>;
      let usdBrl = DEFAULT_USD_BRL_RATE;

      try {
        [quotes, usdBrl] = await Promise.all([
          fetchQuotes(tickerList),
          fetchUsdBrl(),
        ]);
      } catch {
        quotes = new Map();
      }

      const quotesSnapshot: Record<string, { price: number; changePercent: number }> = {};
      quotes.forEach((q, ticker) => {
        quotesSnapshot[ticker] = { price: q.price, changePercent: q.changePercent };
      });

      const today = new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const portfolioLines = filteredAssets.map((a) => {
        const quote = quotes.get(a.ticker);
        const lastPrice = quote?.price ?? parseFloat(a.lastPrice ?? "0");
        const avgCost = parseFloat(a.averageCost ?? "0");
        const qty = parseFloat(a.totalQuantity ?? "0");
        const totalCost = parseFloat(a.totalCost ?? "0");
        const totalValue = lastPrice * qty;
        const profitPct = avgCost > 0 ? ((lastPrice - avgCost) / avgCost) * 100 : 0;
        const changeToday = quote?.changePercent ?? 0;
        const cotas = lastPrice > 0 ? Math.floor(input.availableAmount / lastPrice) : 0;
        const valorCotas = cotas * lastPrice;

        return `- ${a.ticker} (${a.name}):
    Classe: ${a.assetClass} | Moeda: ${a.currency}
    Preço atual: R$ ${lastPrice.toFixed(2)} | Variação hoje: ${changeToday.toFixed(2)}%
    Custo médio: R$ ${avgCost.toFixed(2)} | Qtd: ${qty.toFixed(0)} cotas
    Valor total posição: R$ ${totalValue.toFixed(2)} | Custo total: R$ ${totalCost.toFixed(2)}
    Resultado: ${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(1)}%
    Com R$ ${input.availableAmount.toFixed(2)} → compra ${cotas} cotas (R$ ${valorCotas.toFixed(2)})`;
      }).join("\n\n");

      const systemPrompt = `Você é um Consultor de Investimentos Sênior especialista em renda variável brasileira e internacional.
Perfil do investidor: visão de longo prazo (10+ anos), tolera volatilidade, prefere empresas sólidas com potencial de crescimento e dividendos, realiza aportes mensais recorrentes, prefere comprar ativos já presentes na carteira.
Objetivo: independência financeira dos filhos e crescimento patrimonial consistente.
Diretrizes: nunca recomendar "all in", sempre avaliar downside, evitar viés de confirmação, considerar risco macro, priorizar dados sobre narrativas.

Responda SEMPRE em português brasileiro, de forma estruturada com markdown.
Use emojis de semáforo (🟢🟡🟠🔴) para classificar riscos e fundamentos.
Seja direto e objetivo. Máximo 800 palavras.`;

      const userMessage = `Data de hoje: ${today}
Câmbio USD/BRL: R$ ${usdBrl.toFixed(2)}
Valor disponível para investir: R$ ${input.availableAmount.toFixed(2)}
Foco da análise: ${input.focus === "brasil" ? "Ativos brasileiros" : input.focus === "eua" ? "Ativos EUA" : "Todos os ativos"}
${input.userContext ? `Contexto adicional: ${input.userContext}` : ""}

CARTEIRA ATUAL:
${portfolioLines}

Com base nos dados acima, responda:

1. **Qual ativo devo comprar hoje com R$ ${input.availableAmount.toFixed(2)}?** (Escolha apenas 1, o mais recomendado)
2. **Quantas cotas comprar e a que preço?**
3. **Justificativa fundamentalista e técnica** (máx. 3 parágrafos)
4. **Riscos a considerar** (classificados por semáforo)
5. **Impacto no preço médio** após a compra
6. **Alternativa secundária** caso o ativo principal não esteja disponível

Seja direto. Não repita os dados da carteira. Foque na recomendação e justificativa.`;

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const analysis =
        llmResponse?.choices?.[0]?.message?.content ?? "Não foi possível gerar a análise. Tente novamente.";

      const analysisText = typeof analysis === "string" ? analysis : JSON.stringify(analysis);

      // Extrair ticker recomendado
      const recommendedTicker = extractRecommendedTicker(analysisText);

      // Salvar no histórico
      let historyId: number | null = null;
      try {
        historyId = await createAnalysisHistory({
          userId: ctx.user.id,
          availableAmount: input.availableAmount.toFixed(2),
          focus: input.focus,
          userContext: input.userContext ?? null,
          analysisText,
          recommendedTicker,
          quotesSnapshot: JSON.stringify(quotesSnapshot),
          usdBrl: usdBrl.toFixed(4),
          assetsAnalyzed: filteredAssets.length,
        });
      } catch (err) {
        console.error("[buyAdvisor] Failed to save analysis history:", err);
      }

      return {
        analysis: analysisText,
        updatedAt: new Date(),
        quotesSnapshot,
        usdBrl,
        assetsAnalyzed: filteredAssets.length,
        historyId,
        recommendedTicker,
      };
    }),

  // ========== HISTÓRICO ==========

  /** Lista o histórico de análises do usuário */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return getAnalysisHistoryByUser(ctx.user.id, input.limit);
    }),

  /** Busca uma análise específica pelo ID */
  getHistoryById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const record = await getAnalysisHistoryById(input.id, ctx.user.id);
      if (!record) return null;
      return {
        ...record,
        quotesSnapshot: record.quotesSnapshot
          ? (JSON.parse(record.quotesSnapshot) as Record<string, { price: number; changePercent: number }>)
          : {},
      };
    }),

  /** Remove uma análise do histórico */
  deleteHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAnalysisHistory(input.id, ctx.user.id);
      return { success: true };
    }),
});
