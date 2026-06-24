import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getAssetsByUser } from "../db";
import { fetchQuotes, fetchUsdBrl } from "../quotes";
import { DEFAULT_USD_BRL_RATE } from "../../shared/constants";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  category: "brasil" | "eua" | "commodities" | "crypto" | "fx";
}

interface MacroRate {
  name: string;
  value: number;
  unit: string;
  date: string;
  source: string;
}

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  tickers: string[];
  sentiment: "positive" | "negative" | "neutral";
}

// ─── Índices globais via Yahoo Finance ────────────────────────────────────────

const MARKET_INDICES = [
  // Brasil
  { symbol: "^BVSP",     name: "Ibovespa",     category: "brasil" as const,     currency: "BRL" },
  { symbol: "USDBRL=X",  name: "Dólar (BRL)",  category: "fx" as const,         currency: "BRL" },
  { symbol: "EURBRL=X",  name: "Euro (BRL)",   category: "fx" as const,         currency: "BRL" },
  // EUA
  { symbol: "^GSPC",     name: "S&P 500",      category: "eua" as const,        currency: "USD" },
  { symbol: "^IXIC",     name: "Nasdaq",       category: "eua" as const,        currency: "USD" },
  { symbol: "^DJI",      name: "Dow Jones",    category: "eua" as const,        currency: "USD" },
  { symbol: "^VIX",      name: "VIX (Medo)",   category: "eua" as const,        currency: "USD" },
  // Commodities
  { symbol: "GC=F",      name: "Ouro",         category: "commodities" as const, currency: "USD" },
  { symbol: "CL=F",      name: "Petróleo WTI", category: "commodities" as const, currency: "USD" },
  { symbol: "BZ=F",      name: "Petróleo Brent",category: "commodities" as const,currency: "USD" },
  { symbol: "VALE3.SA",  name: "Minério (VALE3)",category: "brasil" as const,   currency: "BRL" },
  // Crypto
  { symbol: "BTC-USD",   name: "Bitcoin",      category: "crypto" as const,     currency: "USD" },
  { symbol: "ETH-USD",   name: "Ethereum",     category: "crypto" as const,     currency: "USD" },
];

async function fetchSingleIndex(symbol: string): Promise<{ price: number; change: number; changePercent: number; currency: string }> {
  try {
    const encoded = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { price: 0, change: 0, changePercent: 0, currency: "USD" };
    const json = await res.json() as { chart: { result: Array<{ meta: Record<string, number | string> }> } };
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { price: 0, change: 0, changePercent: 0, currency: "USD" };
    const price = (meta.regularMarketPrice as number) ?? 0;
    const prevClose = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const currency = (meta.currency as string) || "USD";
    return { price, change, changePercent, currency };
  } catch {
    return { price: 0, change: 0, changePercent: 0, currency: "USD" };
  }
}

async function fetchMarketIndices(): Promise<IndexQuote[]> {
  // Busca em paralelo usando v8 (v7 retorna 401)
  const results = await Promise.all(
    MARKET_INDICES.map(async (idx) => {
      const q = await fetchSingleIndex(idx.symbol);
      return {
        symbol: idx.symbol,
        name: idx.name,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        currency: q.currency || idx.currency,
        category: idx.category,
      } as IndexQuote;
    })
  );
  return results;
}

// ─── Taxas macro via API do Banco Central ────────────────────────────────────

async function fetchBcbRate(serieCode: number): Promise<{ value: number; date: string } | null> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados/ultimos/1?formato=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ data: string; valor: string }>;
    if (!data.length) return null;
    return { value: parseFloat(data[0].valor), date: data[0].data };
  } catch {
    return null;
  }
}

async function fetchMacroRates(): Promise<MacroRate[]> {
  // Séries do BCB:
  // 11   = Taxa Selic (% a.a.)
  // 12   = CDI (% a.a.)
  // 433  = IPCA acumulado 12 meses
  // 13522 = Meta Selic
  // 4390 = PIB (variação trimestral)
  // 28   = TJLP (% a.a.)

  const [selic, cdi, ipca, metaSelic] = await Promise.all([
    fetchBcbRate(11),
    fetchBcbRate(12),
    fetchBcbRate(13522), // IPCA 12m
    fetchBcbRate(432),   // Meta Selic
  ]);

  const rates: MacroRate[] = [];

  if (selic) rates.push({ name: "Selic (efetiva)", value: selic.value, unit: "% a.a.", date: selic.date, source: "BCB" });
  if (cdi) rates.push({ name: "CDI", value: cdi.value, unit: "% a.a.", date: cdi.date, source: "BCB" });
  if (ipca) rates.push({ name: "IPCA (acum. 12m)", value: ipca.value, unit: "%", date: ipca.date, source: "BCB" });
  if (metaSelic) rates.push({ name: "Meta Selic", value: metaSelic.value, unit: "% a.a.", date: metaSelic.date, source: "BCB" });

  // Juro real estimado (Selic - IPCA)
  if (selic && ipca) {
    const realRate = selic.value - ipca.value;
    rates.push({ name: "Juro Real (Selic - IPCA)", value: realRate, unit: "% a.a.", date: selic.date, source: "Calculado" });
  }

  return rates;
}

// ─── Notícias via Google News RSS ────────────────────────────────────────────

function detectSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const positiveWords = ["alta", "sobe", "crescimento", "lucro", "recorde", "aprovação", "expansão", "positivo", "ganho", "valoriza", "supera", "melhora", "forte", "compra", "recomenda"];
  const negativeWords = ["queda", "cai", "perde", "prejuízo", "risco", "crise", "negativo", "reduz", "corte", "deteriora", "fraco", "venda", "rebaixa", "alerta", "preocupa"];

  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

async function fetchNewsForTickers(tickers: string[]): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];

  // Busca notícias para grupos de tickers para não sobrecarregar
  const searchTerms = [
    ...tickers.slice(0, 5).map((t) => t.replace(".SA", "")),
    "Ibovespa",
    "Selic",
    "mercado financeiro Brasil",
  ];

  for (const term of searchTerms.slice(0, 4)) {
    try {
      const encodedTerm = encodeURIComponent(term);
      const rssUrl = `https://news.google.com/rss/search?q=${encodedTerm}+investimentos+bolsa&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

      const res = await fetch(rssUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const xml = await res.text();

      // Parse simples do RSS
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/;
      const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/;
      const linkRegex = /<link>(.*?)<\/link>/;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
      const sourceRegex = /<source[^>]*>(.*?)<\/source>/;

      let match;
      let count = 0;
      while ((match = itemRegex.exec(xml)) !== null && count < 3) {
        const itemXml = match[1];
        const title = titleRegex.exec(itemXml)?.[1] ?? "";
        const desc = descRegex.exec(itemXml)?.[1] ?? "";
        const url = linkRegex.exec(itemXml)?.[1] ?? "";
        const pubDate = pubDateRegex.exec(itemXml)?.[1] ?? "";
        const source = sourceRegex.exec(itemXml)?.[1] ?? "Google News";

        if (!title || !url) continue;

        // Detectar quais tickers da carteira são mencionados
        const mentionedTickers = tickers.filter((t) => {
          const clean = t.replace(".SA", "");
          return title.includes(clean) || desc.includes(clean);
        });

        const fullText = `${title} ${desc}`;
        const sentiment = detectSentiment(fullText);

        allNews.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          summary: desc.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").substring(0, 200),
          url,
          source,
          publishedAt: pubDate,
          tickers: mentionedTickers.length > 0 ? mentionedTickers : [term.toUpperCase()],
          sentiment,
        });
        count++;
      }
    } catch (err) {
      console.error(`[market] fetchNews error for "${term}":`, err);
    }
  }

  // Deduplica por título
  const seen = new Set<string>();
  return allNews.filter((n) => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  }).slice(0, 20);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const marketRouter = router({
  /** Busca índices globais (Ibovespa, S&P500, Nasdaq, Dólar, Ouro, etc.) */
  getIndices: protectedProcedure.query(async () => {
    const [indices, usdBrl] = await Promise.all([
      fetchMarketIndices(),
      fetchUsdBrl().catch(() => DEFAULT_USD_BRL_RATE),
    ]);
    return { indices, usdBrl, updatedAt: new Date() };
  }),

  /** Busca taxas macro do Banco Central (Selic, CDI, IPCA, Juro Real) */
  getMacroRates: publicProcedure.query(async () => {
    const rates = await fetchMacroRates();
    return { rates, updatedAt: new Date() };
  }),

  /** Busca notícias sobre os ativos da carteira do usuário */
  getPortfolioNews: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(15) }))
    .query(async ({ ctx, input }) => {
      const assets = await getAssetsByUser(ctx.user.id);
      const tickers = assets.map((a) => a.ticker);
      const news = await fetchNewsForTickers(tickers.length > 0 ? tickers : ["Ibovespa"]);
      return { news: news.slice(0, input.limit), updatedAt: new Date() };
    }),

  /** Busca histórico de rentabilidade da carteira vs benchmarks (CDI e Ibovespa) */
  getBenchmarkHistory: protectedProcedure
    .input(z.object({ fromDate: z.string() }))
    .query(async ({ input }) => {
      try {
        const from = Math.floor(new Date(input.fromDate).getTime() / 1000);
        const to = Math.floor(Date.now() / 1000);

        // Buscar Ibovespa histórico
        const ibovRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1mo&period1=${from}&period2=${to}`
        );
        const ibovData = await ibovRes.json();
        const ibovTimestamps = ibovData.chart.result[0].timestamp;
        const ibovClose = ibovData.chart.result[0].indicators.quote[0].close;

        // Normalizar para base 100 (retorno acumulado percentual)
        const ibovBase = ibovClose[0];
        const ibov = ibovTimestamps.map((ts: number, i: number) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 7), // "2023-01"
          value: ((ibovClose[i] / ibovBase) - 1) * 100, // % acumulado
        }));

        // Buscar taxa CDI mensal da API Banco Central
        // Série 4390 = CDI diário acumulado mensal
        const cdiRes = await fetch(
          `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados?formato=json&dataInicial=${input.fromDate.split('-').reverse().join('/')}&dataFinal=${new Date().toLocaleDateString('pt-BR')}`
        );
        const cdiRaw = await cdiRes.json();

        // Acumular CDI mês a mês
        let cdiAcum = 0;
        const cdi = cdiRaw.map((item: { data: string; valor: string }) => {
          cdiAcum += parseFloat(item.valor);
          return {
            date: item.data.slice(6) + '-' + item.data.slice(3, 5), // "2023-01"
            value: cdiAcum,
          };
        });

        return { ibov, cdi };
      } catch (err) {
        console.error("[getBenchmarkHistory] Error:", err);
        return { ibov: [], cdi: [] };
      }
    }),

  /** Busca cotações dos ativos da carteira com variação do dia */
  getPortfolioQuotes: protectedProcedure.query(async ({ ctx }) => {
    const assets = await getAssetsByUser(ctx.user.id);
    if (assets.length === 0) return { quotes: [], updatedAt: new Date() };

    const tickerList = assets.map((a) => ({ ticker: a.ticker, assetClass: a.assetClass }));
    const quotes = await fetchQuotes(tickerList).catch(() => new Map());

    const result = assets.map((a) => {
      const q = quotes.get(a.ticker);
      const lastPrice = q?.price ?? parseFloat(a.lastPrice ?? "0");
      const avgCost = parseFloat(a.averageCost ?? "0");
      const qty = parseFloat(a.totalQuantity ?? "0");
      const totalValue = lastPrice * qty;
      const profitPct = avgCost > 0 ? ((lastPrice - avgCost) / avgCost) * 100 : 0;

      return {
        ticker: a.ticker,
        name: a.name,
        assetClass: a.assetClass,
        currency: a.currency,
        price: lastPrice,
        change: q?.change ?? 0,
        changePercent: q?.changePercent ?? 0,
        avgCost,
        qty,
        totalValue,
        profitPct,
      };
    });

    return {
      quotes: result.sort((a, b) => b.totalValue - a.totalValue),
      updatedAt: new Date(),
    };
  }),
});
