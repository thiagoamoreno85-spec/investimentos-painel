import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Trash2,
  Loader2,
  DollarSign,
  TrendingUp,
  Calendar,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const DIVIDEND_TYPES = [
  { value: "dividendo", label: "Dividendo" },
  { value: "jcp", label: "JCP" },
  { value: "rendimento", label: "Rendimento (FII)" },
  { value: "amortizacao", label: "Amortização" },
  { value: "bonificacao", label: "Bonificação" },
  { value: "outro", label: "Outro" },
] as const;

export default function Dividendos() {
  const utils = trpc.useUtils();

  // Form state
  const [assetId, setAssetId] = useState<string>("");
  const [divType, setDivType] = useState<string>("dividendo");
  const [valuePerShare, setValuePerShare] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
  const [exDate, setExDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: assets, isLoading: assetsLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: summary, isLoading: summaryLoading } = trpc.dividends.getDividendSummary.useQuery();
  const { data: dividends, isLoading: divsLoading } = trpc.dividends.getDividends.useQuery();
  const { data: byMonth } = trpc.dividends.getDividendsByMonth.useQuery();
  const { data: totals } = trpc.dividends.getTotalDividends.useQuery();

  const addDividend = trpc.dividends.addDividend.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Provento registrado! Total: ${formatCurrency(result.totalValue, currency)} para ${result.ticker}`
      );
      utils.dividends.getDividendSummary.invalidate();
      utils.dividends.getDividends.invalidate();
      utils.dividends.getDividendsByMonth.invalidate();
      utils.dividends.getTotalDividends.invalidate();
      // Reset form
      setValuePerShare("");
      setQuantity("");
      setNotes("");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteDividend = trpc.dividends.deleteDividend.useMutation({
    onSuccess: () => {
      toast.success("Provento removido.");
      utils.dividends.getDividendSummary.invalidate();
      utils.dividends.getDividends.invalidate();
      utils.dividends.getDividendsByMonth.invalidate();
      utils.dividends.getTotalDividends.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // Ao selecionar ativo, preencher quantidade automaticamente
  function handleAssetSelect(val: string) {
    setAssetId(val);
    const asset = assets?.find((a) => a.id.toString() === val);
    if (asset) {
      setQuantity(parseFloat(asset.totalQuantity).toFixed(2));
      setCurrency(asset.currency as "BRL" | "USD");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const vps = parseFloat(valuePerShare);
    const qty = parseFloat(quantity);

    if (!assetId || isNaN(vps) || isNaN(qty) || vps <= 0 || qty <= 0) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    addDividend.mutate({
      assetId: parseInt(assetId),
      type: divType as any,
      valuePerShare: vps,
      quantity: qty,
      currency,
      exDate: new Date(exDate + "T12:00:00Z"),
      paymentDate: paymentDate ? new Date(paymentDate + "T12:00:00Z") : undefined,
      notes: notes || undefined,
    });
  }

  function formatCurrency(value: number, curr: string = "BRL") {
    if (curr === "USD") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("pt-BR");
  }

  function getAssetTicker(assetId: number) {
    return assets?.find((a) => a.id === assetId)?.ticker || "—";
  }

  function getAssetCurrency(assetId: number) {
    return (assets?.find((a) => a.id === assetId)?.currency as "BRL" | "USD") || "BRL";
  }

  // Formatar mês para exibição
  function formatMonth(key: string) {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }

  const chartData = useMemo(() => {
    if (!byMonth) return [];
    return byMonth.map((m) => ({
      month: formatMonth(m.month),
      total: m.total,
    }));
  }, [byMonth]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-0">
        {/* Cabeçalho fixo */}
        <div className="flex-shrink-0 pb-3">
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Dividendos & Proventos</h2>
          <p className="text-muted-foreground mt-1">
            Registre dividendos, JCP e rendimentos. Calcule Yield on Cost e Current Yield por ativo.
          </p>
        </div>

        {/* Cards de resumo fixos */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 md:gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Total Recebido
              </CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-base md:text-2xl font-bold font-mono text-emerald-500">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatCurrency(totals?.total || 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {totals?.count || 0} lançamentos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Ativos
              </CardTitle>
              <BarChart2 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-xl md:text-2xl font-bold">
                {summary?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                Com histórico
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Melhor YoC
              </CardTitle>
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-xl md:text-2xl font-bold font-mono text-emerald-500">
                {summary && summary.length > 0
                  ? `${Math.max(...summary.map((s) => s.yieldOnCost)).toFixed(1)}%`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                YoC máximo
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 mt-3">
          {/* Formulário */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Registrar Provento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Ativo */}
                <div>
                  <Label>Ativo *</Label>
                  <Select value={assetId} onValueChange={handleAssetSelect}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue placeholder="Selecionar ativo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assets?.map((a) => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          {a.ticker} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo */}
                <div>
                  <Label>Tipo de Provento</Label>
                  <Select value={divType} onValueChange={setDivType}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIVIDEND_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor por cota e quantidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="vps">Valor/Cota ({currency}) *</Label>
                    <Input
                      id="vps"
                      type="number"
                      step="any"
                      value={valuePerShare}
                      onChange={(e) => setValuePerShare(e.target.value)}
                      placeholder="0.00"
                      className="bg-secondary/50 border-border font-mono"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="qty">Quantidade *</Label>
                    <Input
                      id="qty"
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="bg-secondary/50 border-border font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Total calculado */}
                {valuePerShare && quantity && (
                  <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-muted-foreground">Total do provento</p>
                    <p className="text-lg font-bold font-mono text-emerald-500">
                      {formatCurrency(
                        parseFloat(valuePerShare) * parseFloat(quantity),
                        currency
                      )}
                    </p>
                  </div>
                )}

                {/* Moeda */}
                <div>
                  <Label>Moeda</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as "BRL" | "USD")}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL — Real</SelectItem>
                      <SelectItem value="USD">USD — Dólar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data COM */}
                <div>
                  <Label htmlFor="exDate">Data COM *</Label>
                  <Input
                    id="exDate"
                    type="date"
                    value={exDate}
                    onChange={(e) => setExDate(e.target.value)}
                    className="bg-secondary/50 border-border"
                    required
                  />
                </div>

                {/* Data de pagamento */}
                <div>
                  <Label htmlFor="payDate">Data de Pagamento</Label>
                  <Input
                    id="payDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                </div>

                {/* Observações */}
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                    className="bg-secondary/50 border-border"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={addDividend.isPending}
                >
                  {addDividend.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Registrar Provento
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Conteúdo principal */}
          <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
            {/* Gráfico por mês — menor, fixo */}
            {chartData.length > 0 && (
              <Card className="flex-shrink-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    Proventos por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[130px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.30 0.01 250)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          stroke="oklch(0.55 0 0)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="oklch(0.55 0 0)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          cursor={{ fill: "oklch(0.25 0.01 250 / 0.3)" }}
                          contentStyle={{
                            backgroundColor: "oklch(0.20 0.01 250)",
                            borderColor: "oklch(0.30 0.01 250)",
                            borderRadius: "8px",
                            color: "oklch(0.90 0 0)",
                          }}
                          itemStyle={{ color: "oklch(0.90 0 0)" }}
                          labelStyle={{ color: "oklch(0.70 0 0)" }}
                        />
                        <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Yield on Cost — expandido com scroll interno */}
            <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Yield on Cost por Ativo</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 min-h-0 pt-0">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !summary || summary.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Nenhum provento registrado ainda. Use o formulário ao lado para começar.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border border-border/50">
                    {/* Cabeçalho da tabela fixo */}
                    <div className="flex-shrink-0 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-2 px-2">Ativo</th>
                            <th className="text-right py-2 px-2">Total Recebido</th>
                            <th className="text-right py-2 px-2">YoC Total</th>
                            <th className="text-right py-2 px-2">YoC 12m</th>
                            <th className="text-right py-2 px-2">Yield Atual</th>
                            <th className="text-right py-2 px-2">Qtd</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    {/* Corpo com scroll */}
                    <ScrollArea className="flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <tbody>
                          {summary.map((s) => (
                            <tr
                              key={s.assetId}
                              className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="py-2 px-2 w-[22%]">
                                <p className="font-medium">{s.ticker}</p>
                                <p className="text-xs text-muted-foreground">{s.name}</p>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-emerald-500 w-[20%]">
                                {formatCurrency(s.totalDividends, s.currency)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono w-[15%]">
                                <span className={s.yieldOnCost > 0 ? "text-emerald-500" : "text-muted-foreground"}>
                                  {s.yieldOnCost.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono w-[15%]">
                                <span className={s.yieldOnCostAnnualized > 0 ? "text-emerald-500" : "text-muted-foreground"}>
                                  {s.yieldOnCostAnnualized.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs w-[13%]">
                                {s.currentYield > 0 ? `${s.currentYield.toFixed(2)}%` : "—"}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground w-[10%]">
                                {s.dividendCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de lançamentos — fixo abaixo */}
            <Card className="flex-shrink-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Histórico de Proventos</CardTitle>
              </CardHeader>
              <CardContent>
                {divsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !dividends || dividends.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhum provento registrado.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-2 px-2">Data COM</th>
                          <th className="text-left py-2 px-2">Ativo</th>
                          <th className="text-left py-2 px-2">Tipo</th>
                          <th className="text-right py-2 px-2">Val/Cota</th>
                          <th className="text-right py-2 px-2">Qtd</th>
                          <th className="text-right py-2 px-2">Total</th>
                          <th className="text-center py-2 px-2">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dividends.slice(0, 30).map((div) => {
                          const curr = getAssetCurrency(div.assetId);
                          const typeLabel = DIVIDEND_TYPES.find((t) => t.value === div.type)?.label || div.type;
                          return (
                            <tr
                              key={div.id}
                              className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="py-2 px-2 text-xs text-muted-foreground">
                                {formatDate(div.exDate)}
                              </td>
                              <td className="py-2 px-2 font-medium text-xs">
                                {getAssetTicker(div.assetId)}
                              </td>
                              <td className="py-2 px-2 text-xs">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                                  {typeLabel}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {formatCurrency(parseFloat(div.valuePerShare), curr)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">
                                {parseFloat(div.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-emerald-500">
                                {formatCurrency(parseFloat(div.totalValue), curr)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteDividend.mutate({ dividendId: div.id })}
                                  disabled={deleteDividend.isPending}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
