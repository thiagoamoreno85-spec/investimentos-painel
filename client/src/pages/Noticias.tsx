import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  CheckCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Globe,
  Bitcoin,
  Cpu,
  Flag,
  BarChart2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { filterNewsByTicker, selectMajorExposureNews } from "@shared/newsExposureFilter";
import {
  DEFAULT_NEWS_FILTER_PREFERENCES,
  NEWS_FILTER_PREFERENCES_KEY,
  parseNewsFilterPreferences,
} from "@/lib/newsFilterPreferences";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = "all" | "brasil" | "global" | "cripto" | "tech" | "politica" | "macro";
type ImpactLevel = "all" | "alto" | "medio" | "baixo";

interface NewsItem {
  id: number;
  title: string;
  summary: string | null;
  impactAnalysis: string | null;
  source: string | null;
  sourceUrl: string | null;
  category: string | null;
  impactLevel: string | null;
  sentiment: string | null;
  priceDirection: string | null;
  affectedTickers: string[];
  publishedAt: Date | null;
  createdAt: Date;
  isRead: number;
  priorityScore: number;
  affectedValueBRL: number;
  affectedPortfolioPct: number;
  matchedTickers: string[];
  portfolioRelevance: "alta" | "direta" | "contexto";
}

const PRICE_DIRECTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string; tooltip: string }> = {
  alta_forte:  { label: "Alta Forte",  icon: "⬆️", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-400/40", tooltip: "Previsão de alta forte: potencial de valorização acima de 5% no curto prazo" },
  alta_media:  { label: "Alta Média",  icon: "↗️", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", tooltip: "Previsão de alta média: potencial de valorização entre 2% e 5% no curto prazo" },
  alta_fraca:  { label: "Alta Fraca",  icon: "↗",     color: "text-emerald-500", bg: "bg-emerald-500/5",  border: "border-emerald-600/20", tooltip: "Previsão de alta fraca: potencial de valorização abaixo de 2% no curto prazo" },
  neutro:      { label: "Neutro",      icon: "↔️", color: "text-muted-foreground", bg: "bg-secondary",       border: "border-border",          tooltip: "Sem direção clara: impacto equilibrado ou incerto sobre o preço" },
  baixa_fraca: { label: "Baixa Fraca", icon: "↘",     color: "text-red-500",   bg: "bg-red-500/5",    border: "border-red-600/20",      tooltip: "Previsão de baixa fraca: potencial de desvalorização abaixo de 2% no curto prazo" },
  baixa_media: { label: "Baixa Média", icon: "↘️", color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/30",      tooltip: "Previsão de baixa média: potencial de desvalorização entre 2% e 5% no curto prazo" },
  baixa_forte: { label: "Baixa Forte", icon: "⬇️", color: "text-red-300",   bg: "bg-red-500/15",   border: "border-red-400/40",      tooltip: "Previsão de baixa forte: potencial de desvalorização acima de 5% no curto prazo" },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  brasil: { label: "Brasil", icon: Flag, color: "text-green-400" },
  global: { label: "Global", icon: Globe, color: "text-blue-400" },
  cripto: { label: "Cripto", icon: Bitcoin, color: "text-orange-400" },
  tech: { label: "Tech", icon: Cpu, color: "text-purple-400" },
  politica: { label: "Política", icon: Flag, color: "text-red-400" },
  macro: { label: "Macro", icon: BarChart2, color: "text-cyan-400" },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  alto: {
    label: "Alto Impacto",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  medio: {
    label: "Médio Impacto",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  baixo: {
    label: "Baixo Impacto",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
};

const SENTIMENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  positivo: { icon: TrendingUp, color: "text-emerald-400", label: "Positivo" },
  negativo: { icon: TrendingDown, color: "text-red-400", label: "Negativo" },
  neutro: { icon: Minus, color: "text-muted-foreground", label: "Neutro" },
};

const RELEVANCE_CONFIG = {
  alta: { label: "Prioridade alta", className: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  direta: { label: "Afeta sua carteira", className: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  contexto: { label: "Contexto de mercado", className: "border-border bg-secondary text-muted-foreground" },
};

function formatRelativeTime(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

function NewsCard({ item, onMarkRead }: { item: NewsItem; onMarkRead: (id: number) => void }) {
  const impact = IMPACT_CONFIG[item.impactLevel ?? "baixo"] ?? IMPACT_CONFIG.baixo;
  const sentiment = SENTIMENT_CONFIG[item.sentiment ?? "neutro"] ?? SENTIMENT_CONFIG.neutro;
  const category = CATEGORY_CONFIG[item.category ?? "global"] ?? CATEGORY_CONFIG.global;
  const relevance = RELEVANCE_CONFIG[item.portfolioRelevance ?? "contexto"];
  const SentimentIcon = sentiment.icon;
  const CategoryIcon = category.icon;

  return (
    <Card
      className={`border transition-all duration-200 hover:border-primary/30 cursor-pointer ${
        item.isRead === 0
          ? "bg-card/80 border-border"
          : "bg-card/40 border-border/50 opacity-75"
      }`}
      onClick={() => {
        if (item.isRead === 0) onMarkRead(item.id);
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${impact.bg} ${impact.color} ${impact.border}`}
              >
                {item.impactLevel === "alto" && <AlertTriangle className="w-3 h-3" />}
                {impact.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs ${category.color}`}>
                <CategoryIcon className="w-3 h-3" />
                {category.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs ${sentiment.color}`}>
                <SentimentIcon className="w-3 h-3" />
                {sentiment.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${relevance.className}`}>
                <Target className="h-3 w-3" />
                {relevance.label}
              </span>
              {/* Badge de direção de preço com tooltip */}
              {item.priceDirection && item.priceDirection !== "neutro" && (() => {
                const dir = PRICE_DIRECTION_CONFIG[item.priceDirection] ?? PRICE_DIRECTION_CONFIG.neutro;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border cursor-help ${dir.bg} ${dir.color} ${dir.border}`}
                      >
                        <span>{dir.icon}</span>
                        {dir.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[220px] text-center bg-popover text-popover-foreground border border-border shadow-lg"
                    >
                      <p className="font-semibold mb-0.5">{dir.label}</p>
                      <p className="text-xs opacity-90">{dir.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.isRead === 0 && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Não lida" />
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className={`font-semibold text-sm leading-snug ${item.isRead === 0 ? "text-foreground" : "text-muted-foreground"}`}>
            {item.title}
          </h3>

          {/* Summary */}
          {item.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {item.summary}
            </p>
          )}

          {/* Impact Analysis */}
          {item.impactAnalysis && (
            <div className={`text-xs px-3 py-2 rounded-md border-l-2 ${
              item.impactLevel === "alto"
                ? "border-red-500 bg-red-500/5 text-red-300"
                : item.impactLevel === "medio"
                ? "border-amber-500 bg-amber-500/5 text-amber-300"
                : "border-emerald-500 bg-emerald-500/5 text-emerald-300"
            }`}>
              <span className="font-medium">Impacto na carteira: </span>
              {item.impactAnalysis}
            </div>
          )}

          {/* Footer: tickers + source */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.affectedTickers.slice(0, 6).map((ticker) => (
                <Badge
                  key={ticker}
                  variant="outline"
                  className={`text-xs px-1.5 py-0 font-mono font-bold ${
                    item.impactLevel === "alto"
                      ? "border-red-500/40 text-red-400 bg-red-500/5"
                      : item.impactLevel === "medio"
                      ? "border-amber-500/40 text-amber-400 bg-amber-500/5"
                      : "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                  }`}
                >
                  {ticker}
                </Badge>
              ))}
              {item.affectedTickers.length > 6 && (
                <span className="text-xs text-muted-foreground">+{item.affectedTickers.length - 6}</span>
              )}
            </div>
            {item.affectedPortfolioPct > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                Exposição: {item.affectedPortfolioPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </span>
            )}
            <div className="flex items-center gap-1">
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {item.source ?? "Fonte"}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">{item.source ?? ""}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Noticias() {
  const [savedPreferences] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_NEWS_FILTER_PREFERENCES;
    return parseNewsFilterPreferences(window.localStorage.getItem(NEWS_FILTER_PREFERENCES_KEY));
  });
  const [activeCategory, setActiveCategory] = useState<Category>(savedPreferences.category as Category);
  const [activeImpact, setActiveImpact] = useState<ImpactLevel>(savedPreferences.impact as ImpactLevel);
  const [onlyUnread, setOnlyUnread] = useState(savedPreferences.onlyUnread);
  const [onlyMajorExposure, setOnlyMajorExposure] = useState(savedPreferences.onlyMajorExposure);
  const [selectedTicker, setSelectedTicker] = useState(savedPreferences.selectedTicker);

  const utils = trpc.useUtils();
  const { data: assets = [] } = trpc.portfolio.getAssets.useQuery();

  const { data: news = [], isLoading } = trpc.news.list.useQuery({
    category: activeCategory,
    impactLevel: activeImpact,
    onlyUnread,
    limit: 100,
  });

  const { data: unreadCount = 0 } = trpc.news.unreadCount.useQuery();

  const newsItems = news as NewsItem[];
  const assetTickers = useMemo(
    () => Array.from(new Set(assets.filter((asset) => asset.assetClass !== "caixa").map((asset) => asset.ticker))).sort((a, b) => a.localeCompare(b)),
    [assets]
  );
  const newsForSelectedAsset = useMemo(
    () => filterNewsByTicker(newsItems, selectedTicker),
    [newsItems, selectedTicker]
  );
  const majorExposure = useMemo(() => selectMajorExposureNews(newsForSelectedAsset), [newsForSelectedAsset]);
  const visibleNews = onlyMajorExposure ? majorExposure.items : newsForSelectedAsset;

  useEffect(() => {
    if (selectedTicker !== "all" && assets.length > 0 && !assetTickers.includes(selectedTicker)) {
      setSelectedTicker("all");
    }
  }, [assetTickers, assets.length, selectedTicker]);

  useEffect(() => {
    window.localStorage.setItem(NEWS_FILTER_PREFERENCES_KEY, JSON.stringify({
      category: activeCategory,
      impact: activeImpact,
      onlyUnread,
      onlyMajorExposure,
      selectedTicker,
    }));
  }, [activeCategory, activeImpact, onlyUnread, onlyMajorExposure, selectedTicker]);

  const refreshMutation = trpc.news.refresh.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.news.list.invalidate();
      utils.news.unreadCount.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar notícias: ${err.message}`);
    },
  });

  const markReadMutation = trpc.news.markRead.useMutation({
    onSuccess: () => {
      utils.news.list.invalidate();
      utils.news.unreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.news.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("Todas as notícias marcadas como lidas");
      utils.news.list.invalidate();
      utils.news.unreadCount.invalidate();
    },
  });

  const stats = useMemo(() => {
    const all = visibleNews;
    const alto = all.filter((n) => n.impactLevel === "alto").length;
    const medio = all.filter((n) => n.impactLevel === "medio").length;
    const positivo = all.filter((n) => n.sentiment === "positivo").length;
    const negativo = all.filter((n) => n.sentiment === "negativo").length;

    const tickerCount: Record<string, number> = {};
    all.forEach((n) => {
      n.affectedTickers.forEach((t) => {
        tickerCount[t] = (tickerCount[t] ?? 0) + 1;
      });
    });
    const topTickers = Object.entries(tickerCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { alto, medio, positivo, negativo, topTickers };
  }, [visibleNews]);

  const categories: { value: Category; label: string; icon: React.ElementType }[] = [
    { value: "all", label: "Todas", icon: Newspaper },
    { value: "brasil", label: "Brasil", icon: Flag },
    { value: "global", label: "Global", icon: Globe },
    { value: "cripto", label: "Cripto", icon: Bitcoin },
    { value: "tech", label: "Tech", icon: Cpu },
    { value: "macro", label: "Macro", icon: BarChart2 },
  ];

  const handleUrgentFilter = () => {
    setActiveCategory("all");
    setActiveImpact(activeImpact === "alto" ? "all" : "alto");
  };

  return (
    <DashboardLayout>
      {/*
        Layout: flex column com scroll natural.
        O DashboardLayout agora permite scroll no main.
      */}
      <div className="space-y-4 max-w-full overflow-hidden">

        {/* ── CABEÇALHO FIXO ── */}
        <div className="flex-shrink-0 space-y-3 pb-3">
          {/* Título + botões */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Newspaper className="w-6 h-6 text-primary" />
                Notícias & Análise de Impacto
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground font-bold">
                    {unreadCount} novas
                  </span>
                )}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Notícias ordenadas por impacto, exposição e relação direta com sua carteira
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="min-w-0 px-2 text-xs text-muted-foreground hover:text-foreground sm:px-3 sm:text-sm"
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  <span className="sm:hidden">Marcar lidas</span>
                  <span className="hidden sm:inline">Marcar todas como lidas</span>
                </Button>
              )}
              <Button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                size="sm"
                className="min-w-0 px-2 text-xs whitespace-nowrap bg-primary hover:bg-primary/90 sm:px-3 sm:text-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                {refreshMutation.isPending ? "Analisando..." : <><span className="sm:hidden">Atualizar</span><span className="hidden sm:inline">Atualizar Notícias</span></>}
              </Button>
            </div>
          </div>

          {/* Stats row */}
          {news.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Alto Impacto</p>
                    <p className="text-lg font-bold text-red-400">{stats.alto}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Médio Impacto</p>
                    <p className="text-lg font-bold text-amber-400">{stats.medio}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Positivas</p>
                    <p className="text-lg font-bold text-emerald-400">{stats.positivo}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Negativas</p>
                    <p className="text-lg font-bold text-red-400">{stats.negativo}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filtros — scroll horizontal em mobile */}
          <div className="rounded-lg border border-border/60 bg-card/40 p-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">Buscar por ativo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Mostra apenas notícias que citam um ativo da carteira.</p>
            </div>
            <Select value={selectedTicker} onValueChange={setSelectedTicker}>
              <SelectTrigger size="sm" className="mt-2 w-full sm:mt-0 sm:w-56" aria-label="Filtrar notícias por ativo">
                <SelectValue placeholder="Todos os ativos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ativos</SelectItem>
                {assetTickers.map((ticker) => (
                  <SelectItem key={ticker} value={ticker}>{ticker}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none xl:flex-wrap xl:overflow-visible">
            <div className="flex gap-1.5 flex-shrink-0">
              {categories.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveCategory(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px bg-border self-stretch flex-shrink-0" />

            <div className="flex gap-1.5 flex-shrink-0">
              {(["all", "alto", "medio", "baixo"] as ImpactLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveImpact(level)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeImpact === level
                      ? level === "alto"
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : level === "medio"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : level === "baixo"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level === "all" ? "Todos" : level === "alto" ? "🔴 Alto" : level === "medio" ? "🟡 Médio" : "🟢 Baixo"}
                </button>
              ))}
            </div>

            <button
              onClick={handleUrgentFilter}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeImpact === "alto"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Urgentes {stats.alto > 0 && `(${stats.alto})`}
            </button>

            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                onlyUnread
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Não lidas {unreadCount > 0 && `(${unreadCount})`}
            </button>

            <button
              onClick={() => setOnlyMajorExposure(!onlyMajorExposure)}
              disabled={majorExposure.items.length === 0}
              title={majorExposure.items.length > 0
                ? `Exibe o quartil superior de exposição direta, a partir de ${majorExposure.thresholdPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da carteira.`
                : "Ainda não há notícias com exposição direta calculada."}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                onlyMajorExposure
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Target className="w-3 h-3" />
              Maior exposição {majorExposure.items.length > 0 && `(${majorExposure.items.length})`}
            </button>
          </div>
        </div>

        {/* ── ÁREA DE NOTÍCIAS ── */}
        <div className="flex flex-col lg:flex-row gap-4">

          {/* Lista de notícias */}
          <div className="flex-1 min-w-0">
            <div className="overflow-y-auto pr-1">
              {isLoading ? (
                <div className="space-y-3 pb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-full mb-1" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : visibleNews.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma notícia encontrada</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {selectedTicker !== "all"
                        ? `Não há notícias com vínculo direto ao ativo ${selectedTicker} dentro dos demais filtros selecionados.`
                        : onlyMajorExposure
                        ? "Não há notícias no quartil superior de exposição para a combinação de filtros selecionada."
                        : onlyUnread
                        ? "Todas as notícias já foram lidas."
                        : "Clique em \"Atualizar Notícias\" para buscar e analisar as últimas notícias do mercado."}
                    </p>
                    {!onlyUnread && !onlyMajorExposure && (
                      <Button
                        onClick={() => refreshMutation.mutate()}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                        {refreshMutation.isPending ? "Analisando..." : "Buscar Notícias com IA"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3 pb-4">
                  {visibleNews.map((item) => (
                    <NewsCard
                      key={item.id}
                      item={item}
                      onMarkRead={(id) => markReadMutation.mutate({ id })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Painel lateral — desktop: coluna lateral; mobile: abaixo da lista (oculto por padrão, visível em lg) */}
          {news.length > 0 && (
            <div className="hidden lg:flex lg:w-64 flex-col gap-4 flex-shrink-0">
              {/* Top tickers */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Ativos Mais Citados
                  </h4>
                  <ScrollArea className="h-48 pr-2">
                    <div className="space-y-2">
                      {stats.topTickers.map(([ticker, count]) => (
                        <div key={ticker} className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-foreground">{ticker}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden w-16">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${Math.min(100, (count / (stats.topTickers[0]?.[1] ?? 1)) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Sentimento geral */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Sentimento Geral
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Positivo
                      </span>
                      <span className="text-xs font-bold text-emerald-400">{stats.positivo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Negativo
                      </span>
                      <span className="text-xs font-bold text-red-400">{stats.negativo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Minus className="w-3 h-3" /> Neutro
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {(news as NewsItem[]).filter((n) => n.sentiment === "neutro").length}
                      </span>
                    </div>
                  </div>
                  {news.length > 0 && (
                    <div className="mt-3 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${(stats.positivo / news.length) * 100}%` }}
                      />
                      <div
                        className="bg-muted-foreground/30 transition-all"
                        style={{
                          width: `${((news.length - stats.positivo - stats.negativo) / news.length) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${(stats.negativo / news.length) * 100}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição de impacto */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    Distribuição de Impacto
                  </h4>
                  <div className="space-y-2">
                    {["alto", "medio", "baixo"].map((level) => {
                      const cfg = IMPACT_CONFIG[level];
                      const count = (news as NewsItem[]).filter((n) => n.impactLevel === level).length;
                      const pct = news.length > 0 ? Math.round((count / news.length) * 100) : 0;
                      return (
                        <div key={level}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                            <span className={`text-xs font-bold ${cfg.color}`}>{count}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                level === "alto"
                                  ? "bg-red-500"
                                  : level === "medio"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
