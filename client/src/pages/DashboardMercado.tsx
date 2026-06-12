import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
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
  Minus,
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
  const { data, isLoading, refetch, isFetching } = trpc.market.getIndices.useQuery(undefined, {
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
  const { data, isLoading } = trpc.market.getMacroRates.useQuery(undefined, {
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
        ) : !data?.rates.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Dados indisponíveis no momento.</p>
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
  const { data, isLoading, refetch, isFetching } = trpc.market.getPortfolioQuotes.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Minha Carteira — Cotações do Dia
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 w-7 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.quotes.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum ativo na carteira. Importe em Transações.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Ativo</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Preço</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Dia</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">PM</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Resultado</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Posição</th>
                </tr>
              </thead>
              <tbody>
                {data.quotes.map((q) => (
                  <tr key={q.ticker} className="border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5">
                      <div>
                        <span className="font-mono font-bold text-sm">{q.ticker}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{q.name}</p>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-sm">
                      {q.price === 0 ? "—" : q.currency === "BRL"
                        ? `R$ ${q.price.toFixed(2)}`
                        : `$ ${q.price.toFixed(2)}`}
                    </td>
                    <td className="py-2.5 text-right">
                      <ChangeChip value={q.changePercent} />
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                      {q.avgCost > 0 ? (q.currency === "BRL" ? `R$ ${q.avgCost.toFixed(2)}` : `$ ${q.avgCost.toFixed(2)}`) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`font-mono text-xs font-semibold ${
                        q.profitPct > 0 ? "text-emerald-400" : q.profitPct < 0 ? "text-red-400" : "text-muted-foreground"
                      }`}>
                        {q.profitPct === 0 ? "—" : `${q.profitPct >= 0 ? "+" : ""}${q.profitPct.toFixed(1)}%`}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs">
                      {q.totalValue > 0
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(q.totalValue)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewsSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, refetch, isFetching } = trpc.market.getPortfolioNews.useQuery(
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
  const selic = ratesData?.rates.find((r) => r.name === "Selic (efetiva)");
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
