import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrivacyMask } from "@/components/PrivacyMask";
import { trpc } from "@/lib/trpc";
import { filterMarketAssetsByClass, MARKET_ASSET_TABS, type MarketAssetTabId } from "@shared/marketAssetTabs";
import { sortMarketQuotesByYield, type MarketQuoteSort } from "@shared/marketQuoteSorting";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Newspaper,
  Globe,
  BarChart3,
  DollarSign,
  Activity,
  ExternalLink,
  Clock,
  Loader2,
  ChevronRight,
  ChevronDown,
  Minus,
  ArrowDownAZ,
  ArrowUpAZ,
  WalletCards,
  CalendarDays,
  Layers3,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(value: number, currency: string): string {
  if (value === 0) return "—";
  if (currency === "BRL") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  if (value > 1000) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function ChangeChip({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground text-xs font-mono">—</span>;
  const isPos = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${isPos ? "text-emerald-400" : "text-red-400"}`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function MonthlyChangeChip({ value, isLoading }: { value: number | null | undefined; isLoading: boolean }) {
  if (isLoading) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Calculando variação mensal" />;
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-xs font-mono text-muted-foreground">—</span>;
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs font-mono font-semibold text-muted-foreground"><Minus className="h-3 w-3" />0,00%</span>;
  const isPositive = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Histórico indisponível";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function SentimentBadge({ sentiment }: { sentiment: "positive" | "negative" | "neutral" }) {
  const map = {
    positive: { label: "Positivo", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    negative: { label: "Negativo", class: "bg-red-500/15 text-red-400 border-red-500/30" },
    neutral: { label: "Neutro", class: "bg-secondary text-muted-foreground border-border/50" },
  };
  const { label, class: cls } = map[sentiment];
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs border ${cls}`}>{label}</span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  brasil: "🇧🇷 Brasil",
  eua: "🇺🇸 EUA",
  commodities: "🛢️ Commodities",
  crypto: "₿ Cripto",
  fx: "💱 Câmbio",
};

// ─── Componentes de seção ─────────────────────────────────────────────────────

function IndicesSection() {
  const { data, isLoading, isError, refetch, isFetching } = trpc.market.getIndices.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const grouped = data?.indices.reduce((acc, idx) => {
    if (!acc[idx.category]) acc[idx.category] = [];
    acc[idx.category].push(idx);
    return acc;
  }, {} as Record<string, typeof data.indices>) ?? {};

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Índices Globais
          </CardTitle>
          <div className="flex items-center gap-2">
            {data?.updatedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(data.updatedAt).toLocaleTimeString("pt-BR")}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 w-7 p-0">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !data?.indices.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Índices indisponíveis no momento. Nenhum valor estimado será exibido.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, indices]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {indices.map((idx) => (
                    <div
                      key={idx.symbol}
                      className={`p-3 rounded-lg border transition-colors ${
                        idx.changePercent > 0
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : idx.changePercent < 0
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-secondary/30 border-border/30"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground truncate">{idx.name}</p>
                      <p className="font-mono font-bold text-sm mt-1">
                        {idx.price === 0 ? "—" : formatPrice(idx.price, idx.currency)}
                      </p>
                      <ChangeChip value={idx.changePercent} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MacroRatesSection() {
  const { data, isLoading, isError, refetch, isFetching } = trpc.market.getMacroRates.useQuery(undefined, {
    refetchInterval: 300_000, // 5 min
  });

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Taxas Macro — Banco Central
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !data?.rates.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Dados macro indisponíveis no momento.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.rates.map((rate) => (
              <div key={rate.name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{rate.name}</p>
                  <p className="text-xs text-muted-foreground">{rate.source} · {rate.date}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-bold text-lg ${
                    rate.name.includes("Real") && rate.value > 6 ? "text-emerald-400" :
                    rate.name.includes("IPCA") && rate.value > 4.5 ? "text-amber-400" :
                    "text-foreground"
                  }`}>
                    {rate.value.toFixed(2)}<span className="text-xs text-muted-foreground ml-1">{rate.unit}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioQuotesSection() {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<MarketAssetTabId>("rv_nacional");
  const [quoteSort, setQuoteSort] = useState<MarketQuoteSort>("portfolio");
  const { data, isLoading, isError, refetch, isFetching } = trpc.market.getPortfolioQuotes.useQuery(undefined, { refetchInterval: 60_000 });
  const monthlyQuery = trpc.market.getPortfolioMonthlyChanges.useQuery(undefined, { refetchInterval: 300_000, retry: 1 });
  const monthlyByTicker = useMemo(() => new Map((monthlyQuery.data?.changes ?? []).map((item) => [item.ticker, item])), [monthlyQuery.data?.changes]);
  const quotesInActiveClass = useMemo(
    () => sortMarketQuotesByYield(filterMarketAssetsByClass(data?.quotes ?? [], activeClass), quoteSort),
    [activeClass, data?.quotes, quoteSort],
  );

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><WalletCards className="w-5 h-5 text-amber-400" />Minha Carteira — Cotações e Posições</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Preço, desempenho diário, variação mensal e detalhes da posição por ativo.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 w-7 shrink-0 p-0" aria-label="Atualizar cotações"><RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center"><p className="text-sm text-muted-foreground">Não foi possível obter as cotações da carteira.</p><Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2"><RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />Tentar novamente</Button></div>
        ) : !data?.quotes.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo financeiro cadastrado.</p>
        ) : (
          <div className="space-y-3">
            <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              <div className="flex min-w-max gap-2">
                {MARKET_ASSET_TABS.map((assetTab) => {
                  const isActive = activeClass === assetTab.id;
                  return (
                    <button
                      key={assetTab.id}
                      type="button"
                      onClick={() => {
                        setActiveClass(assetTab.id);
                        setExpandedTicker(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-primary/45 bg-primary/10 text-foreground shadow-sm"
                          : "border-border/50 bg-secondary/25 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className={`h-2 w-2 rounded-full ${assetTab.dotClass}`} />
                      {assetTab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2 px-1 sm:flex-row sm:items-center">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <p className="text-xs text-muted-foreground">{MARKET_ASSET_TABS.find((assetTab) => assetTab.id === activeClass)?.label}</p>
                <span className="font-mono text-xs text-muted-foreground">{quotesInActiveClass.length} ativo{quotesInActiveClass.length === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/25 p-1" aria-label="Ordenar por rendimento acumulado">
                <button
                  type="button"
                  onClick={() => setQuoteSort("yield_desc")}
                  className={`flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${quoteSort === "yield_desc" ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  aria-pressed={quoteSort === "yield_desc"}
                  title="Ordenar rendimento (L/P) do maior para o menor"
                >
                  <ArrowDownAZ className="h-3 w-3" /> Melhor L/P
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteSort("yield_asc")}
                  className={`flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${quoteSort === "yield_asc" ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  aria-pressed={quoteSort === "yield_asc"}
                  title="Ordenar rendimento (L/P) do menor para o maior"
                >
                  <ArrowUpAZ className="h-3 w-3" /> Pior L/P
                </button>
              </div>
            </div>

            {quotesInActiveClass.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-secondary/15 px-4 py-8 text-center text-sm text-muted-foreground">
                Não há ativos desta classe com cotação na carteira.
              </div>
            ) : (
              <div className="space-y-2">
                {quotesInActiveClass.map((q) => {
              const monthly = monthlyByTicker.get(q.ticker);
              const isExpanded = expandedTicker === q.ticker;
              const profitValue = (q.price - q.avgCost) * q.qty;
              return (
                    <article key={q.ticker} className={`overflow-hidden rounded-xl border bg-card/60 shadow-sm transition-colors ${q.profitPct < 0 ? "border-red-500/25" : "border-border/60 hover:border-primary/35"}`}>
                      <button type="button" onClick={() => setExpandedTicker((current) => current === q.ticker ? null : q.ticker)} aria-expanded={isExpanded} className="w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(5rem,0.9fr)_minmax(3.6rem,0.6fr)_minmax(3.6rem,0.6fr)_minmax(5.75rem,0.9fr)_1rem] items-center gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)_minmax(4.5rem,0.7fr)_minmax(4.5rem,0.7fr)_minmax(6.5rem,1fr)_1rem]">
                          <div className="min-w-0"><span className="font-mono text-sm font-bold text-foreground">{q.ticker}</span><p className="mt-0.5 truncate text-xs text-muted-foreground">{q.name}</p></div>
                          <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preço</p><PrivacyMask as="span" className="mt-0.5 block truncate font-mono text-xs font-semibold">{formatPrice(q.price, q.currency)}</PrivacyMask></div>
                          <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dia</p><div className="mt-0.5"><ChangeChip value={q.changePercent} /></div></div>
                          <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mês</p><div className="mt-0.5"><MonthlyChangeChip value={monthly?.changePercent} isLoading={monthlyQuery.isLoading} /></div></div>
                          <div className="min-w-0 text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Posição</p><PrivacyMask as="span" className="mt-0.5 block truncate font-mono text-xs font-semibold">{formatPrice(q.totalValue, q.currency)}</PrivacyMask></div>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/50 bg-secondary/15 px-3 py-3 text-xs sm:grid-cols-3">
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">Quantidade</p><PrivacyMask as="span" className="mt-1 block font-mono">{q.qty.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</PrivacyMask></div>
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">Preço médio</p><PrivacyMask as="span" className="mt-1 block font-mono">{q.avgCost > 0 ? formatPrice(q.avgCost, q.currency) : "—"}</PrivacyMask></div>
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">L/P</p><PrivacyMask as="span" className={`mt-1 block font-mono font-semibold ${q.profitPct > 0 ? "text-emerald-400" : q.profitPct < 0 ? "text-red-400" : "text-muted-foreground"}`}>{q.profitPct === 0 ? "—" : `${q.profitPct >= 0 ? "+" : ""}${q.profitPct.toFixed(2)}%`}</PrivacyMask></div>
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">L/P em valor</p><PrivacyMask as="span" className={`mt-1 block font-mono font-semibold ${profitValue > 0 ? "text-emerald-400" : profitValue < 0 ? "text-red-400" : "text-muted-foreground"}`}>{formatPrice(profitValue, q.currency)}</PrivacyMask></div>
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">Base do mês</p><PrivacyMask as="span" className="mt-1 block font-mono">{monthly?.referencePrice ? formatPrice(monthly.referencePrice, q.currency) : "—"}</PrivacyMask></div>
                          <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">Data-base</p><p className="mt-1 flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3" />{formatShortDate(monthly?.referenceDate)}</p></div>
                          <div className="col-span-2 flex items-center justify-between gap-3 rounded-md border border-border/50 bg-card/40 px-2.5 py-2 sm:col-span-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Layers3 className="h-3.5 w-3.5" />Variação mensal de preço</span><span className="text-right text-[10px] text-muted-foreground">Preço atual versus último fechamento antes do mês; não inclui proventos.</span></div>
                        </div>
                      )}
                    </article>
              );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewsSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = trpc.market.getPortfolioNews.useQuery(
    { limit: 20 },
    { refetchInterval: 300_000 }
  );

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-400" />
            Notícias — Carteira & Mercado
          </CardTitle>
          <div className="flex items-center gap-2">
            {data?.updatedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(data.updatedAt).toLocaleTimeString("pt-BR")}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 w-7 p-0">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível atualizar as notícias agora.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </div>
        ) : !data?.news.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notícia encontrada no momento.</p>
        ) : (
          <div className="space-y-2">
            {data.news.map((item, i) => (
              <div
                key={i}
                className={`rounded-lg border transition-colors ${
                  item.sentiment === "positive" ? "border-emerald-500/20 bg-emerald-500/5" :
                  item.sentiment === "negative" ? "border-red-500/20 bg-red-500/5" :
                  "border-border/30 bg-secondary/20"
                }`}
              >
                <button
                  className="w-full text-left p-3"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <SentimentBadge sentiment={item.sentiment} />
                        {item.tickers.slice(0, 3).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-secondary border border-border/50 text-xs font-mono text-muted-foreground">
                            {t.replace(".SA", "")}
                          </span>
                        ))}
                        <span className="text-xs text-muted-foreground ml-auto">{item.source}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform mt-0.5 ${expanded === i ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {expanded === i && (
                  <div className="px-3 pb-3 border-t border-border/30 pt-2">
                    {item.summary && (
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{item.summary}...</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleString("pt-BR") : ""}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ler completo <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Componente de resumo do dia ──────────────────────────────────────────────

function DaySummaryBar() {
  const { data: indicesData } = trpc.market.getIndices.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: ratesData } = trpc.market.getMacroRates.useQuery(undefined, { refetchInterval: 300_000 });

  const ibov = indicesData?.indices.find((i) => i.symbol === "^BVSP");
  const sp500 = indicesData?.indices.find((i) => i.symbol === "^GSPC");
  const dolar = indicesData?.indices.find((i) => i.symbol === "USDBRL=X");
  const btc = indicesData?.indices.find((i) => i.symbol === "BTC-USD");
  const selic = ratesData?.rates.find((r) => r.name === "Meta Selic (COPOM)");
  const ipca = ratesData?.rates.find((r) => r.name === "IPCA (acum. 12m)");

  const items = [
    { label: "Ibovespa", value: ibov?.price, change: ibov?.changePercent, format: (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " pts" },
    { label: "S&P 500", value: sp500?.price, change: sp500?.changePercent, format: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " pts" },
    { label: "Dólar", value: dolar?.price, change: dolar?.changePercent, format: (v: number) => `R$ ${v.toFixed(2)}` },
    { label: "Bitcoin", value: btc?.price, change: btc?.changePercent, format: (v: number) => `$ ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: "Selic", value: selic?.value, change: null, format: (v: number) => `${v.toFixed(2)}% a.a.` },
    { label: "IPCA 12m", value: ipca?.value, change: null, format: (v: number) => `${v.toFixed(2)}%` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(({ label, value, change, format }) => (
        <Card key={label} className={`bg-card/50 border-border/50 shadow-sm ${
          change !== null && change !== undefined && change > 0 ? "border-l-2 border-l-emerald-500/50" :
          change !== null && change !== undefined && change < 0 ? "border-l-2 border-l-red-500/50" :
          ""
        }`}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-mono font-bold text-sm mt-0.5">
              {value !== undefined && value !== 0 ? format(value) : <span className="text-muted-foreground">—</span>}
            </p>
            {change !== null && change !== undefined && (
              <ChangeChip value={change} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardMercado() {
  const [activeTab, setActiveTab] = useState<"overview" | "portfolio" | "news">("overview");

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight flex items-center gap-2 md:gap-3">
            <Globe className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
            Dashboard de Mercado
          </h2>
          <p className="text-muted-foreground mt-1">
            Índices globais, taxas macro, cotações da carteira e notícias em tempo real.
          </p>
        </div>

        {/* Barra de resumo do dia */}
        <DaySummaryBar />

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-full sm:w-fit border border-border/50 overflow-x-auto">
          {[
            { id: "overview", label: "Índices & Macro", icon: Globe },
            { id: "portfolio", label: "Minha Carteira", icon: BarChart3 },
            { id: "news", label: "Notícias", icon: Newspaper },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3 h-3 md:w-4 md:h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo por aba */}
        {activeTab === "overview" && (
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
            <div className="col-span-1 lg:col-span-2">
              <IndicesSection />
            </div>
            <div>
              <MacroRatesSection />
            </div>
          </div>
        )}

        {activeTab === "portfolio" && (
          <PortfolioQuotesSection />
        )}

        {activeTab === "news" && (
          <NewsSection />
        )}
      </div>
    </DashboardLayout>
  );
}
