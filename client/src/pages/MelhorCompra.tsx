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
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const FOCUS_OPTIONS = [
  { value: "brasil", label: "🇧🇷 Ativos Brasileiros", description: "Ações, FIIs e fundos nacionais" },
  { value: "eua", label: "🇺🇸 Ativos EUA", description: "Stocks e ETFs americanos" },
  { value: "todos", label: "🌎 Todos os Ativos", description: "Análise completa da carteira" },
] as const;

const QUICK_VALUES = [500, 1000, 1200, 1500, 2000, 3000, 5000];

export default function MelhorCompra() {
  const [amount, setAmount] = useState("1200");
  const [focus, setFocus] = useState<"brasil" | "eua" | "todos">("brasil");
  const [userContext, setUserContext] = useState("");
  const [result, setResult] = useState<{
    analysis: string;
    updatedAt: Date;
    quotesSnapshot: Record<string, { price: number; changePercent: number }>;
    usdBrl?: number;
    assetsAnalyzed?: number;
  } | null>(null);

  const { data: assets } = trpc.portfolio.getAssets.useQuery();

  const analyze = trpc.buyAdvisor.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Análise concluída com sucesso!");
    },
    onError: (err) => {
      toast.error(`Erro ao analisar: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    analyze.mutate({
      availableAmount: parsed,
      focus,
      userContext: userContext.trim() || undefined,
    });
  }

  const totalAssets = assets?.length ?? 0;
  const brazilianAssets = assets?.filter((a) => a.assetClass !== "rv_eua").length ?? 0;
  const usAssets = assets?.filter((a) => a.assetClass === "rv_eua").length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              Melhor Compra do Dia
            </h2>
            <p className="text-muted-foreground mt-1">
              Informe o valor disponível e a IA analisa sua carteira com cotações em tempo real para recomendar o melhor ativo.
            </p>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ativos na Carteira</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {brazilianAssets} BR · {usAssets} EUA
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Análise por IA</CardTitle>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">Tempo Real</div>
              <p className="text-xs text-muted-foreground mt-1">Cotações + fundamentos + macro</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Última Análise</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {result
                  ? new Date(result.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {result ? new Date(result.updatedAt).toLocaleDateString("pt-BR") : "Nenhuma análise ainda"}
              </p>
            </CardContent>
          </Card>
        </div>

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
                  {/* Valor disponível */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">
                      Valor Disponível (R$) *
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                        R$
                      </span>
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

                    {/* Atalhos de valor */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
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

                  {/* Foco */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Foco da Análise *</Label>
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

                  {/* Contexto adicional */}
                  <div className="space-y-2">
                    <Label htmlFor="context" className="text-sm font-medium">
                      Contexto Adicional{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Textarea
                      id="context"
                      value={userContext}
                      onChange={(e) => setUserContext(e.target.value)}
                      placeholder="Ex: prefiro ativo com dividendos, estou preocupado com a Selic, quero reduzir exposição a commodities..."
                      className="bg-secondary/50 border-border resize-none text-sm"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {userContext.length}/500
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-base"
                    disabled={analyze.isPending || totalAssets === 0}
                  >
                    {analyze.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analisando carteira...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Analisar Melhor Compra
                      </>
                    )}
                  </Button>

                  {totalAssets === 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-500">
                        Sua carteira está vazia. Importe seus ativos na página de Transações antes de usar esta funcionalidade.
                      </p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Cotações do snapshot */}
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
                        <div
                          key={ticker}
                          className="flex items-center justify-between py-1 border-b border-border/30 last:border-0"
                        >
                          <span className="font-mono text-sm font-semibold">{ticker}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm">
                              R$ {q.price.toFixed(2)}
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                q.changePercent >= 0 ? "text-emerald-500" : "text-red-500"
                              }`}
                            >
                              {q.changePercent >= 0 ? "+" : ""}
                              {q.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Resultado da análise */}
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
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Buscando cotações em tempo real, avaliando fundamentos e gerando recomendação personalizada.
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Cotações
                    </span>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      Recomendação da IA
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(result.updatedAt).toLocaleString("pt-BR")}
                      {result.assetsAnalyzed !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {result.assetsAnalyzed} ativos analisados
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:text-foreground prose-headings:font-bold
                    prose-p:text-muted-foreground prose-p:leading-relaxed
                    prose-strong:text-foreground
                    prose-ul:text-muted-foreground prose-li:marker:text-primary
                    prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
                    prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                    prose-code:text-amber-400 prose-code:bg-secondary/50 prose-code:px-1 prose-code:rounded">
                    <Streamdown>{result.analysis}</Streamdown>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground italic">
                      ⚠️ Esta análise tem caráter informativo e educacional, com base em dados públicos disponíveis no momento da consulta. Não constitui recomendação formal de investimento. Decisões de compra e venda são de responsabilidade exclusiva do investidor.
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-border bg-secondary/50 hover:bg-secondary"
                      onClick={() => {
                        const parsed = parseFloat(amount.replace(",", "."));
                        if (!isNaN(parsed) && parsed > 0) {
                          analyze.mutate({
                            availableAmount: parsed,
                            focus,
                            userContext: userContext.trim() || undefined,
                          });
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
                      Informe o valor disponível ao lado, escolha o foco da análise e clique em{" "}
                      <strong className="text-amber-400">Analisar Melhor Compra</strong>.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-sm">
                    {[
                      { icon: TrendingUp, label: "Cotações em tempo real" },
                      { icon: BarChart3, label: "Análise fundamentalista" },
                      { icon: Sparkles, label: "Recomendação por IA" },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/30"
                      >
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
      </div>
    </DashboardLayout>
  );
}
