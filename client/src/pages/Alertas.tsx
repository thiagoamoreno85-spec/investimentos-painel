import { useState } from "react";
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
  Bell,
  BellOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Target,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ALERT_TYPES = [
  {
    value: "buy_opportunity",
    label: "Oportunidade de Compra",
    description: "Dispara quando o preço cai X% abaixo do custo médio",
    icon: ShoppingCart,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    thresholdLabel: "Queda mínima (%)",
    showTarget: false,
  },
  {
    value: "below_avg_cost",
    label: "Abaixo do Custo Médio",
    description: "Dispara quando o preço está X% abaixo do custo médio",
    icon: TrendingDown,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    thresholdLabel: "Queda mínima (%)",
    showTarget: false,
  },
  {
    value: "price_drop",
    label: "Queda Brusca",
    description: "Dispara quando o preço cai X% em relação ao custo médio",
    icon: TrendingDown,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    thresholdLabel: "Queda mínima (%)",
    showTarget: false,
  },
  {
    value: "price_rise",
    label: "Alta Significativa",
    description: "Dispara quando o preço sobe X% acima do custo médio",
    icon: TrendingUp,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    thresholdLabel: "Alta mínima (%)",
    showTarget: false,
  },
  {
    value: "below_target",
    label: "Abaixo do Preço-Alvo",
    description: "Dispara quando o preço cai abaixo de um valor específico",
    icon: Target,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    thresholdLabel: "Threshold (%)",
    showTarget: true,
  },
  {
    value: "above_target",
    label: "Acima do Preço-Alvo",
    description: "Dispara quando o preço sobe acima de um valor específico",
    icon: Target,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    thresholdLabel: "Threshold (%)",
    showTarget: true,
  },
  {
    value: "news_alert",
    label: "Alerta de Notícia",
    description: "Gerado automaticamente por notícia de alto impacto na carteira",
    icon: Bell,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    thresholdLabel: "Threshold (%)",
    showTarget: false,
  },
] as const;

export default function Alertas() {
  const utils = trpc.useUtils();

  const [assetId, setAssetId] = useState<string>("");
  const [alertType, setAlertType] = useState<string>("buy_opportunity");
  const [threshold, setThreshold] = useState("10");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "triggered" | "dismissed">("all");

  const { data: assets } = trpc.portfolio.getAssets.useQuery();
  const { data: alertsList, isLoading } = trpc.alerts.getAlerts.useQuery({ status: filterStatus });
  const { data: counts, refetch: refetchCounts } = trpc.alerts.getAlertCounts.useQuery();

  const createAlert = trpc.alerts.createAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta criado com sucesso!");
      utils.alerts.getAlerts.invalidate();
      utils.alerts.getAlertCounts.invalidate();
      setAssetId("");
      setThreshold("10");
      setTargetPrice("");
      setNotes("");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const dismissAlert = trpc.alerts.dismissAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta dispensado.");
      utils.alerts.getAlerts.invalidate();
      utils.alerts.getAlertCounts.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const reactivateAlert = trpc.alerts.reactivateAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta reativado.");
      utils.alerts.getAlerts.invalidate();
      utils.alerts.getAlertCounts.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteAlert = trpc.alerts.deleteAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta removido.");
      utils.alerts.getAlerts.invalidate();
      utils.alerts.getAlertCounts.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const checkAlerts = trpc.alerts.checkAlerts.useMutation({
    onSuccess: (result) => {
      if (result.triggered.length === 0) {
        toast.success("Verificação concluída — nenhum alerta disparado.");
      } else {
        result.triggered.forEach((t) => {
          toast.warning(t.message, { duration: 6000 });
        });
      }
      utils.alerts.getAlerts.invalidate();
      utils.alerts.getAlertCounts.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId) {
      toast.error("Selecione um ativo.");
      return;
    }

    const selectedType = ALERT_TYPES.find((t) => t.value === alertType);
    const tp = selectedType?.showTarget && targetPrice ? parseFloat(targetPrice) : undefined;

    createAlert.mutate({
      assetId: parseInt(assetId),
      type: alertType as any,
      threshold: parseFloat(threshold),
      targetPrice: tp,
      notes: notes || undefined,
    });
  }

  function getAssetTicker(assetId: number) {
    return assets?.find((a) => a.id === assetId)?.ticker || "—";
  }

  function getAssetName(assetId: number) {
    return assets?.find((a) => a.id === assetId)?.name || "—";
  }

  function getAlertTypeInfo(type: string) {
    return ALERT_TYPES.find((t) => t.value === type) || ALERT_TYPES[0];
  }

  const selectedTypeInfo = ALERT_TYPES.find((t) => t.value === alertType);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex-shrink-0 flex items-start justify-between pb-3">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Alertas de Monitoramento</h2>
            <p className="text-muted-foreground mt-1">
              Configure alertas automáticos para oportunidades de compra e riscos na carteira.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-border bg-secondary/50 hover:bg-secondary"
            onClick={() => checkAlerts.mutate()}
            disabled={checkAlerts.isPending}
          >
            {checkAlerts.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Verificar Alertas
          </Button>
        </div>

        {/* Cards de contagem — fixos */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 md:gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Ativos</CardTitle>
              <Bell className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-blue-500">{counts?.active ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">Monitorando</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Disparados</CardTitle>
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-amber-500">{counts?.triggered ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">Aguardando ação</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:px-6 md:pt-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total</CardTitle>
              <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
              <div className="text-xl md:text-2xl font-bold">
                {(counts?.active ?? 0) + (counts?.triggered ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">Ativos + disparados</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 mt-3">
          {/* Formulário */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Novo Alerta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Ativo */}
                <div>
                  <Label>Ativo *</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
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

                {/* Tipo de alerta */}
                <div>
                  <Label>Tipo de Alerta *</Label>
                  <Select value={alertType} onValueChange={setAlertType}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTypeInfo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedTypeInfo.description}
                    </p>
                  )}
                </div>

                {/* Threshold */}
                <div>
                  <Label htmlFor="threshold">
                    {selectedTypeInfo?.thresholdLabel || "Threshold (%)"}
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    step="any"
                    min="0"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="bg-secondary/50 border-border font-mono"
                    required
                  />
                </div>

                {/* Preço-alvo (apenas para above_target e below_target) */}
                {selectedTypeInfo?.showTarget && (
                  <div>
                    <Label htmlFor="targetPrice">Preço-Alvo *</Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      step="any"
                      min="0"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-secondary/50 border-border font-mono"
                      required
                    />
                  </div>
                )}

                {/* Observações */}
                <div>
                  <Label htmlFor="alertNotes">Observações</Label>
                  <Input
                    id="alertNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                    className="bg-secondary/50 border-border"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={createAlert.isPending}
                >
                  {createAlert.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  Criar Alerta
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de alertas — coluna com scroll interno */}
          <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "active", "triggered", "dismissed"] as const).map((s) => (
                <Button
                  key={s}
                  variant={filterStatus === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                  className={
                    filterStatus === s
                      ? "bg-primary text-primary-foreground"
                      : "border-border bg-secondary/50 hover:bg-secondary"
                  }
                >
                  {s === "all" ? "Todos" : s === "active" ? "Ativos" : s === "triggered" ? "Disparados" : "Dispensados"}
                  {s === "triggered" && counts?.triggered ? (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-black font-bold">
                      {counts.triggered}
                    </span>
                  ) : null}
                </Button>
              ))}
            </div>

            <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardContent className="flex flex-col flex-1 min-h-0 pt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !alertsList || alertsList.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">
                      {filterStatus === "all"
                        ? "Nenhum alerta configurado. Crie seu primeiro alerta ao lado."
                        : `Nenhum alerta com status "${filterStatus}".`}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-3 pr-2">
                    {alertsList.map((alert) => {
                      const typeInfo = getAlertTypeInfo(alert.type);
                      const Icon = typeInfo.icon;
                      return (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-lg border ${typeInfo.bg} ${typeInfo.border} transition-all`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`mt-0.5 p-1.5 rounded-md ${typeInfo.bg}`}>
                                <Icon className={`w-4 h-4 ${typeInfo.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">
                                    {getAssetTicker(alert.assetId)}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo.bg} ${typeInfo.color} font-medium`}>
                                    {typeInfo.label}
                                  </span>
                                  {alert.status === "triggered" && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-medium">
                                      ⚡ Disparado
                                    </span>
                                  )}
                                  {alert.status === "dismissed" && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                                      Dispensado
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {getAssetName(alert.assetId)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Threshold: <span className="font-mono font-medium">{parseFloat(alert.threshold).toFixed(1)}%</span>
                                  {alert.targetPrice && (
                                    <> · Preço-alvo: <span className="font-mono font-medium">{parseFloat(alert.targetPrice).toFixed(2)}</span></>
                                  )}
                                </p>
                                {alert.triggeredMessage && (
                                  <p className="text-xs text-amber-500 mt-1 font-medium whitespace-pre-line">
                                    {alert.triggeredMessage}
                                  </p>
                                )}
                                {/* Badge de direção de preço para alertas de notícia */}
                                {alert.type === "news_alert" && alert.notes && (() => {
                                  const dirMatch = alert.notes.match(/Direção de preço: ([\w_]+)/);
                                  const dir = dirMatch?.[1];
                                  const PRICE_DIR: Record<string, { label: string; icon: string; color: string; bg: string; tooltip: string }> = {
                                    alta_forte:  { label: "Alta Forte (>5%)",  icon: "⬆️", color: "text-emerald-300", bg: "bg-emerald-500/15", tooltip: "Previsão de alta forte: potencial de valorização acima de 5% no curto prazo" },
                                    alta_media:  { label: "Alta Média (2-5%)",  icon: "↗️", color: "text-emerald-400", bg: "bg-emerald-500/10", tooltip: "Previsão de alta média: potencial de valorização entre 2% e 5% no curto prazo" },
                                    alta_fraca:  { label: "Alta Fraca (<2%)",   icon: "↗",     color: "text-emerald-500", bg: "bg-emerald-500/5",  tooltip: "Previsão de alta fraca: potencial de valorização abaixo de 2% no curto prazo" },
                                    neutro:      { label: "Neutro",             icon: "↔️", color: "text-muted-foreground", bg: "bg-secondary",      tooltip: "Sem direção clara: impacto equilibrado ou incerto sobre o preço" },
                                    baixa_fraca: { label: "Baixa Fraca (<2%)",  icon: "↘",     color: "text-red-500",   bg: "bg-red-500/5",    tooltip: "Previsão de baixa fraca: potencial de desvalorização abaixo de 2% no curto prazo" },
                                    baixa_media: { label: "Baixa Média (2-5%)", icon: "↘️", color: "text-red-400",   bg: "bg-red-500/10",   tooltip: "Previsão de baixa média: potencial de desvalorização entre 2% e 5% no curto prazo" },
                                    baixa_forte: { label: "Baixa Forte (>5%)",  icon: "⬇️", color: "text-red-300",   bg: "bg-red-500/15",   tooltip: "Previsão de baixa forte: potencial de desvalorização acima de 5% no curto prazo" },
                                  };
                                  const cfg = dir ? PRICE_DIR[dir] : null;
                                  if (!cfg || dir === "neutro") return null;
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mt-1 cursor-help ${cfg.bg} ${cfg.color}`}>
                                          <span>{cfg.icon}</span>
                                          Previsão: {cfg.label}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-[220px] text-center bg-popover text-popover-foreground border border-border shadow-lg"
                                      >
                                        <p className="font-semibold mb-0.5">{cfg.label}</p>
                                        <p className="text-xs opacity-90">{cfg.tooltip}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })()}
                                {alert.triggeredAt && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Disparado em: {new Date(alert.triggeredAt).toLocaleString("pt-BR")}
                                  </p>
                                )}
                                {alert.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    {alert.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {alert.status === "triggered" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                                  onClick={() => reactivateAlert.mutate({ alertId: alert.id })}
                                  disabled={reactivateAlert.isPending}
                                  title="Reativar alerta"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {alert.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                                  onClick={() => dismissAlert.mutate({ alertId: alert.id })}
                                  disabled={dismissAlert.isPending}
                                  title="Dispensar alerta"
                                >
                                  <BellOff className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteAlert.mutate({ alertId: alert.id })}
                                disabled={deleteAlert.isPending}
                                title="Excluir alerta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
