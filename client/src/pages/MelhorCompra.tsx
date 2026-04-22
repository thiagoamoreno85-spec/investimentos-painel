import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  RefreshCw,
  DollarSign,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Clock,
  History,
  Trash2,
  Eye,
  Calendar,
  Target,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const FOCUS_OPTIONS = [
  { value: "brasil", label: "🇧🇷 Ativos Brasileiros", description: "Ações, FIIs e fundos nacionais" },
  { value: "eua", label: "🇺🇸 Ativos EUA", description: "Stocks e ETFs americanos" },
  { value: "todos", label: "🌎 Todos os Ativos", description: "Análise completa da carteira" },
] as const;

const QUICK_VALUES = [500, 1000, 1200, 1500, 2000, 3000, 5000];

const FOCUS_LABELS: Record<string, string> = {
  brasil: "🇧🇷 Brasil",
  eua: "🇺🇸 EUA",
  todos: "🌎 Todos",
};

export default function MelhorCompra() {
  const [amount, setAmount] = useState("1200");
  const [focus, setFocus] = useState<"brasil" | "eua" | "todos">("brasil");
  const [userContext, setUserContext] = useState("");
  const [activeTab, setActiveTab] = useState<"analyze" | "history">("analyze");
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const [result, setResult] = useState<{
    analysis: string;
    updatedAt: Date;
    quotesSnapshot: Record<string, { price: number; changePercent: number }>;
    usdBrl?: number;
    assetsAnalyzed?: number;
    recommendedTicker?: string | null;
    historyId?: number | null;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: assets } = trpc.portfolio.getAssets.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.buyAdvisor.getHistory.useQuery({ limit: 50 });
  const { data: selectedRecord } = trpc.buyAdvisor.getHistoryById.useQuery(
    { id: selectedHistoryId! },
    { enabled: selectedHistoryId !== null }
  );

  const analyze = trpc.buyAdvisor.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.buyAdvisor.getHistory.invalidate();
      toast.success("Análise concluída e salva no histórico!");
    },
    onError: (err) => {
      toast.error(`Erro ao analisar: ${err.message}`);
    },
  });

  const deleteHistory = trpc.buyAdvisor.deleteHistory.useMutation({
    onSuccess: () => {
      utils.buyAdvisor.getHistory.invalidate();
      toast.success("Análise removida do histórico.");
    },
    onError: () => toast.error("Erro ao remover análise."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    analyze.mutate({ availableAmount: parsed, focus, userContext: userContext.trim() || undefined });
  }

  const totalAssets = assets?.length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-400" />
            Melhor Compra do Dia
          </h2>
          <p className="text-muted-foreground mt-1">
            IA analisa sua carteira com cotações em tempo real e recomenda o melhor ativo para comprar.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit border border-border/50">
          {[
            { id: "analyze", label: "Nova Análise", icon: Sparkles },
            { id: "history", label: `Histórico (${history?.length ?? 0})`, icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as "analyze" | "history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ===== TAB: NOVA ANÁLISE ===== */}
        {activeTab === "analyze" && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Formulário */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    Configurar Análise
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor Disponível (R$) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">R$</span>
                        <Input
                          id="amount"
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="pl-10 bg-secondary/50 border-border font-mono text-lg h-12"
                          placeholder="1.200,00"
                          required
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_VALUES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAmount(v.toString())}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors font-mono ${
                              parseFloat(amount) === v
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {v >= 1000 ? `R$${v / 1000}k` : `R$${v}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Foco da Análise *</Label>
                      <Select value={focus} onValueChange={(v) => setFocus(v as typeof focus)}>
                        <SelectTrigger className="bg-secondary/50 border-border h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOCUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div>
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-xs text-muted-foreground">{opt.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="context">
                        Contexto Adicional <span className="text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <Textarea
                        id="context"
                        value={userContext}
                        onChange={(e) => setUserContext(e.target.value)}
                        placeholder="Ex: prefiro dividendos, preocupado com Selic..."
                        className="bg-secondary/50 border-border resize-none text-sm"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground text-right">{userContext.length}/500</p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-base"
                      disabled={analyze.isPending || totalAssets === 0}
                    >
                      {analyze.isPending ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analisando...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" /> Analisar Melhor Compra</>
                      )}
                    </Button>

                    {totalAssets === 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-500">Carteira vazia. Importe ativos em Transações primeiro.</p>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Snapshot de cotações */}
              {result && Object.keys(result.quotesSnapshot).length > 0 && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      Cotações Utilizadas
                      {result.usdBrl && (
                        <span className="ml-auto text-xs text-muted-foreground font-normal">
                          USD/BRL: R$ {result.usdBrl.toFixed(2)}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1.5">
                      {Object.entries(result.quotesSnapshot)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([ticker, q]) => (
                          <div key={ticker} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                            <span className="font-mono text-sm font-semibold">{ticker}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm">R$ {q.price.toFixed(2)}</span>
                              <span className={`text-xs font-mono ${q.changePercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Resultado */}
            <div className="lg:col-span-3">
              {analyze.isPending ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm h-full">
                  <CardContent className="flex flex-col items-center justify-center py-20 gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                      <Sparkles className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-semibold text-lg">Analisando sua carteira...</p>
                      <p className="text-muted-foreground text-sm max-w-xs">Buscando cotações, avaliando fundamentos e gerando recomendação.</p>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Cotações</span>
                      <ChevronRight className="w-3 h-3" />
                      <span>Fundamentos</span>
                      <ChevronRight className="w-3 h-3" />
                      <span>Recomendação</span>
                    </div>
                  </CardContent>
                </Card>
              ) : result ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                  <CardHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        Recomendação da IA
                        {result.recommendedTicker && (
                          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-sm font-mono font-bold border border-amber-500/30">
                            {result.recommendedTicker}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(result.updatedAt).toLocaleString("pt-BR")}
                        {result.assetsAnalyzed !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary">{result.assetsAnalyzed} ativos</span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="prose prose-invert prose-sm max-w-none
                      prose-headings:text-foreground prose-headings:font-bold
                      prose-p:text-muted-foreground prose-p:leading-relaxed
                      prose-strong:text-foreground
                      prose-ul:text-muted-foreground
                      prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
                      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                      prose-code:text-amber-400 prose-code:bg-secondary/50 prose-code:px-1 prose-code:rounded">
                      <Streamdown>{result.analysis}</Streamdown>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground italic">
                        ⚠️ Análise informativa com base em dados públicos. Não constitui recomendação formal de investimento.
                      </p>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <History className="w-3.5 h-3.5" />
                        Salvo no histórico
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-border bg-secondary/50"
                        onClick={() => {
                          const parsed = parseFloat(amount.replace(",", "."));
                          if (!isNaN(parsed) && parsed > 0) {
                            analyze.mutate({ availableAmount: parsed, focus, userContext: userContext.trim() || undefined });
                          }
                        }}
                        disabled={analyze.isPending}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reanalisar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm h-full">
                  <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-lg">Pronto para analisar</p>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Informe o valor, escolha o foco e clique em <strong className="text-amber-400">Analisar Melhor Compra</strong>.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-sm">
                      {[
                        { icon: TrendingUp, label: "Cotações em tempo real" },
                        { icon: BarChart3, label: "Análise fundamentalista" },
                        { icon: Sparkles, label: "Recomendação por IA" },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/30">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: HISTÓRICO ===== */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !history || history.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <History className="w-12 h-12 text-muted-foreground/40" />
                  <div>
                    <p className="font-semibold">Nenhuma análise no histórico</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Gere sua primeira análise na aba "Nova Análise".
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("analyze")} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Ir para Nova Análise
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Estatísticas do histórico */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-card/50 border-border/50 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <History className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{history.length}</p>
                          <p className="text-xs text-muted-foreground">Total de análises</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 border-border/50 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono">
                            {history.filter((h) => h.recommendedTicker).length > 0
                              ? (() => {
                                  const counts: Record<string, number> = {};
                                  history.forEach((h) => { if (h.recommendedTicker) counts[h.recommendedTicker] = (counts[h.recommendedTicker] ?? 0) + 1; });
                                  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
                                })()
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Mais recomendado</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 border-border/50 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono">
                            R$ {(history.reduce((s, h) => s + parseFloat(h.availableAmount), 0) / history.length).toFixed(0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Valor médio analisado</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 border-border/50 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {new Date(history[0].createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </p>
                          <p className="text-xs text-muted-foreground">Última análise</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista do histórico */}
                <div className="space-y-3">
                  {history.map((item) => (
                    <Card key={item.id} className="bg-card/50 border-border/50 shadow-sm hover:border-border transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          {/* Ticker recomendado */}
                          <div className="w-16 h-16 rounded-xl bg-secondary/50 border border-border/50 flex flex-col items-center justify-center shrink-0">
                            {item.recommendedTicker ? (
                              <>
                                <span className="font-mono font-bold text-sm text-amber-400 leading-tight">{item.recommendedTicker}</span>
                                <span className="text-xs text-muted-foreground">recom.</span>
                              </>
                            ) : (
                              <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-emerald-400">
                                R$ {parseFloat(item.availableAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground border border-border/50">
                                {FOCUS_LABELS[item.focus] ?? item.focus}
                              </span>
                              {item.assetsAnalyzed && (
                                <span className="text-xs text-muted-foreground">{item.assetsAnalyzed} ativos</span>
                              )}
                            </div>
                            {item.userContext && (
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                "{item.userContext}"
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(item.createdAt).toLocaleString("pt-BR")}
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-border bg-secondary/50 hover:bg-secondary"
                              onClick={() => setSelectedHistoryId(item.id)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 bg-transparent"
                              onClick={() => {
                                if (confirm("Remover esta análise do histórico?")) {
                                  deleteHistory.mutate({ id: item.id });
                                }
                              }}
                              disabled={deleteHistory.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de visualização completa */}
      <Dialog open={selectedHistoryId !== null} onOpenChange={(open) => { if (!open) setSelectedHistoryId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Análise Completa
              {selectedRecord?.recommendedTicker && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-sm font-mono font-bold border border-amber-500/30">
                  {selectedRecord.recommendedTicker}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRecord ? (
            <div className="space-y-4">
              {/* Meta da análise */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Valor", value: `R$ ${parseFloat(selectedRecord.availableAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                  { label: "Foco", value: FOCUS_LABELS[selectedRecord.focus] ?? selectedRecord.focus },
                  { label: "Ativos", value: `${selectedRecord.assetsAnalyzed ?? "—"} analisados` },
                  { label: "Data", value: new Date(selectedRecord.createdAt).toLocaleString("pt-BR") },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {selectedRecord.userContext && (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Contexto fornecido</p>
                  <p className="text-sm italic">"{selectedRecord.userContext}"</p>
                </div>
              )}

              {/* Cotações snapshot */}
              {selectedRecord.quotesSnapshot && Object.keys(selectedRecord.quotesSnapshot).length > 0 && (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Cotações no momento da análise
                    {selectedRecord.usdBrl && (
                      <span className="ml-auto">USD/BRL: R$ {parseFloat(selectedRecord.usdBrl).toFixed(2)}</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(selectedRecord.quotesSnapshot).map(([ticker, q]) => (
                      <div key={ticker} className="flex items-center justify-between px-2 py-1.5 rounded bg-background/50 border border-border/30">
                        <span className="font-mono text-xs font-semibold">{ticker}</span>
                        <div className="text-right">
                          <span className="font-mono text-xs">R$ {q.price.toFixed(2)}</span>
                          <span className={`ml-2 text-xs font-mono ${q.changePercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Texto da análise */}
              <div className="prose prose-invert prose-sm max-w-none
                prose-headings:text-foreground prose-headings:font-bold
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-strong:text-foreground
                prose-ul:text-muted-foreground
                prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
                prose-code:text-amber-400 prose-code:bg-secondary/50 prose-code:px-1 prose-code:rounded">
                <Streamdown>{selectedRecord.analysisText}</Streamdown>
              </div>

              <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-3">
                ⚠️ Análise informativa com base em dados públicos. Não constitui recomendação formal de investimento.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
