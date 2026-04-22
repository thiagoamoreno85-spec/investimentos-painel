import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getAssetsByUser } from "../db";
import { fetchQuotes, fetchUsdBrl } from "../quotes";
import { invokeLLM } from "../_core/llm";

export const buyAdvisorRouter = router({
  /**
   * Analisa a carteira do usuário e recomenda qual ativo comprar
   * com o valor informado, usando LLM com contexto de cotações em tempo real.
   */
  analyze: protectedProcedure
    .input(
      z.object({
        availableAmount: z.number().positive(),
        /** Foco opcional: "brasil" | "eua" | "todos" */
        focus: z.enum(["brasil", "eua", "todos"]).default("brasil"),
        /** Contexto adicional fornecido pelo usuário */
        userContext: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Buscar ativos do usuário
      const assets = await getAssetsByUser(ctx.user.id);

      if (assets.length === 0) {
        return {
          analysis: "Sua carteira está vazia. Importe seus ativos primeiro na página de Transações.",
          updatedAt: new Date(),
          quotesSnapshot: {},
        };
      }

      // 2. Filtrar por foco
      const filteredAssets = assets.filter((a) => {
        if (input.focus === "brasil") return a.assetClass !== "rv_eua";
        if (input.focus === "eua") return a.assetClass === "rv_eua";
        return true;
      });

      if (filteredAssets.length === 0) {
        return {
          analysis: `Nenhum ativo encontrado para o foco "${input.focus}". Verifique sua carteira.`,
          updatedAt: new Date(),
          quotesSnapshot: {},
        };
      }

      // 3. Buscar cotações em tempo real
      const tickerList = filteredAssets.map((a) => ({
        ticker: a.ticker,
        assetClass: a.assetClass,
      }));

      let quotes: Map<string, { price: number; change: number; changePercent: number; currency: string }>;
      let usdBrl = 5.7;

      try {
        [quotes, usdBrl] = await Promise.all([
          fetchQuotes(tickerList),
          fetchUsdBrl(),
        ]);
      } catch {
        quotes = new Map();
      }

      // 4. Montar snapshot de cotações para retorno
      const quotesSnapshot: Record<string, { price: number; changePercent: number }> = {};
      quotes.forEach((q, ticker) => {
        quotesSnapshot[ticker] = { price: q.price, changePercent: q.changePercent };
      });

      // 5. Montar contexto da carteira para o LLM
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

        // Quantas cotas o usuário pode comprar com o valor disponível
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
Seu perfil do investidor: visão de longo prazo (10+ anos), tolera volatilidade, prefere empresas sólidas com potencial de crescimento e dividendos, realiza aportes mensais recorrentes, prefere comprar ativos já presentes na carteira.
Objetivo de longo prazo: independência financeira dos filhos e crescimento patrimonial consistente.
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

      // 6. Chamar o LLM
      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const analysis =
        llmResponse?.choices?.[0]?.message?.content ?? "Não foi possível gerar a análise. Tente novamente.";

      return {
        analysis: typeof analysis === "string" ? analysis : JSON.stringify(analysis),
        updatedAt: new Date(),
        quotesSnapshot,
        usdBrl,
        assetsAnalyzed: filteredAssets.length,
      };
    }),
});
