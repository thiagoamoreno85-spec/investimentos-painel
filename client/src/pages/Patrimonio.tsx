import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Trash2,
  Plus,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CheckCircle2,
  Calendar,
  Loader2,
  Eye,
  EyeOff,
  Home,
  Car,
  Briefcase,
  Landmark,
  Package,
  MoreHorizontal,
} from "lucide-react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  credito: "Crédito",
  participacao: "Participação",
  equipamento: "Equipamento",
  outro: "Outro",
};

const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  imovel: <Home className="h-4 w-4" />,
  veiculo: <Car className="h-4 w-4" />,
  credito: <Landmark className="h-4 w-4" />,
  participacao: <Briefcase className="h-4 w-4" />,
  equipamento: <Package className="h-4 w-4" />,
  outro: <MoreHorizontal className="h-4 w-4" />,
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  imovel: "text-cyan-400",
  veiculo: "text-violet-400",
  credito: "text-amber-400",
  participacao: "text-emerald-400",
  equipamento: "text-blue-400",
  outro: "text-slate-400",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Patrimonio() {
  const { user } = useAuth();
  const { showBalances, toggleShowBalances } = useBalanceVisibility();
  const utils = trpc.useUtils();

  // Dialog state
  const [assetDialog, setAssetDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    liabilityId: number;
    liabilityName: string;
    remainingBalance: number;
  }>({ open: false, liabilityId: 0, liabilityName: "", remainingBalance: 0 });

  // Queries
  const { data: summary, isLoading: summaryLoading } =
    trpc.patrimonial.getSummary.useQuery();
  const { data: assets, isLoading: assetsLoading } =
    trpc.patrimonial.listAssets.useQuery();
  const { data: liabilities, isLoading: liabilitiesLoading } =
    trpc.patrimonial.listLiabilities.useQuery();

  // Mutations
  const deleteAsset = trpc.patrimonial.deleteAsset.useMutation({
    onSuccess: () => {
      utils.patrimonial.listAssets.invalidate();
      utils.patrimonial.getSummary.invalidate();
      utils.patrimonial.getConsolidatedNetWorth.invalidate();
      toast.success("Ativo removido");
    },
  });

  const deleteLiability = trpc.patrimonial.deleteLiability.useMutation({
    onSuccess: () => {
      utils.patrimonial.listLiabilities.invalidate();
      utils.patrimonial.getSummary.invalidate();
      utils.patrimonial.getConsolidatedNetWorth.invalidate();
      toast.success("Passivo removido");
    },
  });

  if (!user) return null;

  const blurClass = !showBalances ? "blur-sm select-none" : "";

  // Mapear passivos por assetId para exibir vinculados
  const liabilitiesByAssetId = useMemo(() => {
    if (!liabilities) return {} as Record<number, typeof liabilities>;
    const map: Record<number, typeof liabilities> = {};
    for (const l of liabilities) {
      if (l.assetId) {
        if (!map[l.assetId]) map[l.assetId] = [];
        map[l.assetId].push(l);
      }
    }
    return map;
  }, [liabilities]);

  // Passivos sem ativo vinculado
  const orphanLiabilities = useMemo(
    () => (liabilities ?? []).filter((l) => !l.assetId),
    [liabilities]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Patrimônio
              </p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
              Ativos &amp; Passivos
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Controle de imóveis, veículos, créditos e financiamentos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleShowBalances}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              {showBalances ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {showBalances ? "Ocultar" : "Mostrar"}
              </span>
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setAssetDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Novo Ativo
            </Button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {summaryLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="bg-card/50 backdrop-blur-sm border-border/50 animate-pulse h-24"
              />
            ))}
          </div>
        ) : summary ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {/* Total Ativos */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total de Ativos
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className={`text-xl font-bold font-mono tracking-tight text-emerald-400 ${blurClass}`}
                >
                  {formatCurrency(summary.totalAssets)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.assetCount} ativo
                  {summary.assetCount !== 1 ? "s" : ""} registrado
                  {summary.assetCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Total Passivos */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total de Passivos
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className={`text-xl font-bold font-mono tracking-tight text-red-400 ${blurClass}`}
                >
                  {formatCurrency(summary.totalLiabilities)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.liabilityCount} passivo
                  {summary.liabilityCount !== 1 ? "s" : ""} em aberto
                </p>
              </CardContent>
            </Card>

            {/* Patrimônio Líquido */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Patrimônio Líquido
                </CardTitle>
                <TrendingUp
                  className={`h-4 w-4 ${summary.netWorth >= 0 ? "text-cyan-400" : "text-red-400"}`}
                />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className={`text-xl font-bold font-mono tracking-tight ${summary.netWorth >= 0 ? "text-cyan-400" : "text-red-400"} ${blurClass}`}
                >
                  {formatCurrency(summary.netWorth)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ativos − Passivos
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* ── Cards de Resumo por Tipo ── */}
        {assets && assets.length > 0 && (() => {
          // Calcular totais por tipo
          const byType: Record<string, { totalValue: number; totalDebt: number; count: number }> = {};
          for (const asset of assets) {
            const lbs = liabilitiesByAssetId[asset.id] ?? [];
            const debt = lbs.reduce((s: number, l: any) => s + l.remainingBalance, 0);
            if (!byType[asset.assetType]) byType[asset.assetType] = { totalValue: 0, totalDebt: 0, count: 0 };
            byType[asset.assetType].totalValue += asset.currentValue;
            byType[asset.assetType].totalDebt += debt;
            byType[asset.assetType].count += 1;
          }
          const types = Object.keys(byType);
          return (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                Resumo por Tipo
              </h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {types.map((type) => {
                  const { totalValue, totalDebt, count } = byType[type];
                  const net = totalValue - totalDebt;
                  const color = ASSET_TYPE_COLORS[type] ?? "text-slate-400";
                  const icon = ASSET_TYPE_ICONS[type] ?? <MoreHorizontal className="h-4 w-4" />;
                  const label = ASSET_TYPE_LABELS[type] ?? type;
                  return (
                    <Card key={type} className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                      <CardContent className="p-3">
                        <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
                          {icon}
                          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                        </div>
                        <div className={`text-sm font-bold font-mono ${color} ${blurClass}`}>
                          {formatCurrency(net)}
                        </div>
                        <div className={`text-[10px] font-mono text-muted-foreground ${blurClass}`}>
                          Bruto: {formatCurrency(totalValue)}
                        </div>
                        {totalDebt > 0 && (
                          <div className={`text-[10px] font-mono text-red-400/70 ${blurClass}`}>
                            Dívida: −{formatCurrency(totalDebt)}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60 mt-1">
                          {count} ativo{count !== 1 ? "s" : ""}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Ativos agrupados por tipo ── */}
        {assetsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50 animate-pulse h-28" />
            ))}
          </div>
        ) : !assets || assets.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum ativo registrado</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Clique em "Novo Ativo" para começar</p>
            </CardContent>
          </Card>
        ) : (() => {
          // Agrupar ativos por tipo
          const grouped: Record<string, typeof assets> = {};
          for (const asset of assets) {
            if (!grouped[asset.assetType]) grouped[asset.assetType] = [];
            grouped[asset.assetType].push(asset);
          }
          const typeOrder = ["imovel", "veiculo", "credito", "participacao", "equipamento", "outro"];
          const sortedTypes = typeOrder.filter((t) => grouped[t]).concat(
            Object.keys(grouped).filter((t) => !typeOrder.includes(t))
          );
          return (
            <div className="space-y-6">
              {sortedTypes.map((type) => {
                const typeAssets = grouped[type];
                const color = ASSET_TYPE_COLORS[type] ?? "text-slate-400";
                const icon = ASSET_TYPE_ICONS[type] ?? <MoreHorizontal className="h-4 w-4" />;
                const label = ASSET_TYPE_LABELS[type] ?? type;
                return (
                  <div key={type}>
                    <div className={`flex items-center gap-2 mb-3 ${color}`}>
                      {icon}
                      <h3 className="text-sm font-semibold uppercase tracking-widest">{label}</h3>
                      <span className="text-xs text-muted-foreground font-normal normal-case tracking-normal">
                        ({typeAssets.length} ativo{typeAssets.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="space-y-3">
                      {typeAssets.map((asset) => {
                        const linkedLiabilities = liabilitiesByAssetId[asset.id] ?? [];
                        const totalDebt = linkedLiabilities.reduce((s: number, l: any) => s + l.remainingBalance, 0);
                        const netValue = asset.currentValue - totalDebt;
                        return (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            linkedLiabilities={linkedLiabilities}
                            totalDebt={totalDebt}
                            netValue={netValue}
                            showBalances={showBalances}
                            onDelete={() => deleteAsset.mutate({ id: asset.id })}
                            onDeleteLiability={(id) => deleteLiability.mutate({ id })}
                            onRegisterPayment={(liabilityId, name, balance) =>
                              setPaymentDialog({ open: true, liabilityId, liabilityName: name, remainingBalance: balance })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Passivos sem ativo vinculado ── */}
        {orphanLiabilities.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Passivos Avulsos
              </h3>
            </div>
            <div className="space-y-3">
              {orphanLiabilities.map((liability) => (
                <LiabilityRow
                  key={liability.id}
                  liability={liability}
                  showBalances={showBalances}
                  onDelete={() => deleteLiability.mutate({ id: liability.id })}
                  onRegisterPayment={(id, name, balance) =>
                    setPaymentDialog({
                      open: true,
                      liabilityId: id,
                      liabilityName: name,
                      remainingBalance: balance,
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: Novo Ativo (+ passivo opcional) ── */}
      <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-cyan-400" />
              Novo Ativo Patrimonial
            </DialogTitle>
          </DialogHeader>
          <CreateAssetWithLiabilityForm
            onSuccess={() => {
              setAssetDialog(false);
              utils.patrimonial.listAssets.invalidate();
              utils.patrimonial.listLiabilities.invalidate();
              utils.patrimonial.getSummary.invalidate();
              utils.patrimonial.getConsolidatedNetWorth.invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Registrar Pagamento ── */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) =>
          setPaymentDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2 mb-1">
            {paymentDialog.liabilityName}
          </p>
          <RegisterPaymentForm
            liabilityId={paymentDialog.liabilityId}
            remainingBalance={paymentDialog.remainingBalance}
            onSuccess={() => {
              setPaymentDialog((prev) => ({ ...prev, open: false }));
              utils.patrimonial.listLiabilities.invalidate();
              utils.patrimonial.getSummary.invalidate();
              utils.patrimonial.getConsolidatedNetWorth.invalidate();
            }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── AssetCard ────────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: any;
  linkedLiabilities: any[];
  totalDebt: number;
  netValue: number;
  showBalances: boolean;
  onDelete: () => void;
  onDeleteLiability: (id: number) => void;
  onRegisterPayment: (
    liabilityId: number,
    name: string,
    balance: number
  ) => void;
}

function AssetCard({
  asset,
  linkedLiabilities,
  totalDebt,
  netValue,
  showBalances,
  onDelete,
  onDeleteLiability,
  onRegisterPayment,
}: AssetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const blurClass = !showBalances ? "blur-sm select-none" : "";
  const typeColor = ASSET_TYPE_COLORS[asset.assetType] ?? "text-slate-400";
  const typeIcon = ASSET_TYPE_ICONS[asset.assetType] ?? (
    <MoreHorizontal className="h-4 w-4" />
  );
  const typeLabel = ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all duration-200 hover:border-border">
      <CardContent className="p-4">
        {/* Linha principal */}
        <div className="flex items-start justify-between gap-3">
          {/* Ícone + Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`mt-0.5 p-2 rounded-lg bg-card border border-border/50 ${typeColor}`}
            >
              {typeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{asset.name}</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border-border/50 ${typeColor}`}
                >
                  {typeLabel}
                </Badge>
                {linkedLiabilities.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400"
                  >
                    {linkedLiabilities.length} passivo
                    {linkedLiabilities.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {asset.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {asset.description}
                </p>
              )}
            </div>
          </div>

          {/* Valores */}
          <div className="text-right shrink-0">
            <div className={`text-sm font-bold font-mono ${blurClass}`}>
              {formatCurrency(asset.currentValue)}
            </div>
            {linkedLiabilities.length > 0 && (
              <>
                <div
                  className={`text-xs font-mono text-red-400/80 ${blurClass}`}
                >
                  −{formatCurrency(totalDebt)}
                </div>
                <div
                  className={`text-xs font-mono font-semibold mt-0.5 ${netValue >= 0 ? "text-cyan-400" : "text-red-400"} ${blurClass}`}
                >
                  = {formatCurrency(netValue)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Linha de ações */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {asset.acquisitionDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(asset.acquisitionDate)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {linkedLiabilities.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Passivos
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Passivos vinculados (expandível) */}
        {expanded && linkedLiabilities.length > 0 && (
          <div className="mt-3 space-y-2">
            {linkedLiabilities.map((liability) => (
              <LiabilityRow
                key={liability.id}
                liability={liability}
                showBalances={showBalances}
                compact
                onDelete={() => onDeleteLiability(liability.id)}
                onRegisterPayment={onRegisterPayment}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── LiabilityRow ─────────────────────────────────────────────────────────────

interface LiabilityRowProps {
  liability: any;
  showBalances: boolean;
  compact?: boolean;
  onDelete: () => void;
  onRegisterPayment: (
    liabilityId: number,
    name: string,
    balance: number
  ) => void;
}

function LiabilityRow({
  liability,
  showBalances,
  compact = false,
  onDelete,
  onRegisterPayment,
}: LiabilityRowProps) {
  const blurClass = !showBalances ? "blur-sm select-none" : "";
  const isQuitado = liability.remainingBalance <= 0;
  const progress =
    liability.totalInstallments && liability.paidInstallments
      ? Math.round(
          (liability.paidInstallments / liability.totalInstallments) * 100
        )
      : liability.originalAmount > 0
        ? Math.round(
            ((liability.originalAmount - liability.remainingBalance) /
              liability.originalAmount) *
              100
          )
        : 0;

  return (
    <div
      className={`rounded-lg border border-border/40 bg-card/30 p-3 ${compact ? "text-xs" : "text-sm"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{liability.name}</span>
            {isQuitado ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400"
              >
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                Quitado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400"
              >
                Em aberto
              </Badge>
            )}
          </div>
          {liability.creditor && (
            <p className="text-muted-foreground mt-0.5">
              Credor: {liability.creditor}
            </p>
          )}

          {/* Barra de progresso */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {liability.paidInstallments ?? 0}
                {liability.totalInstallments
                  ? ` / ${liability.totalInstallments} parcelas`
                  : " pagamentos"}
              </span>
              <span>{progress}% pago</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Valores */}
        <div className="text-right shrink-0">
          <div className={`font-mono font-semibold text-red-400 ${blurClass}`}>
            {formatCurrency(liability.remainingBalance)}
          </div>
          <div className={`text-[10px] font-mono text-muted-foreground ${blurClass}`}>
            de {formatCurrency(liability.originalAmount)}
          </div>
          {liability.installmentValue && (
            <div className={`text-[10px] font-mono text-muted-foreground ${blurClass}`}>
              Parcela: {formatCurrency(liability.installmentValue)}
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      {!isQuitado && (
        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/20">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() =>
              onRegisterPayment(
                liability.id,
                liability.name,
                liability.remainingBalance
              )
            }
          >
            <CreditCard className="h-3 w-3" />
            Dar Baixa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-destructive/70 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── CreateAssetWithLiabilityForm ─────────────────────────────────────────────

function CreateAssetWithLiabilityForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<"asset" | "liability">("asset");
  const [createdAssetId, setCreatedAssetId] = useState<number | null>(null);
  const [addLiability, setAddLiability] = useState(false);

  const [assetForm, setAssetForm] = useState({
    name: "",
    assetType: "imovel" as
      | "imovel"
      | "veiculo"
      | "credito"
      | "participacao"
      | "equipamento"
      | "outro",
    currentValue: "",
    acquisitionValue: "",
    acquisitionDate: "",
    description: "",
    notes: "",
  });

  const createAsset = trpc.patrimonial.createAsset.useMutation({
    onSuccess: (result) => {
      if (addLiability) {
        setCreatedAssetId(result.id);
        setStep("liability");
      } else {
        toast.success("Ativo cadastrado com sucesso!");
        onSuccess();
      }
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAsset.mutate({
      name: assetForm.name,
      assetType: assetForm.assetType,
      currentValue: parseFloat(assetForm.currentValue),
      acquisitionValue: assetForm.acquisitionValue
        ? parseFloat(assetForm.acquisitionValue)
        : undefined,
      acquisitionDate: assetForm.acquisitionDate
        ? new Date(assetForm.acquisitionDate)
        : undefined,
      description: assetForm.description || undefined,
      notes: assetForm.notes || undefined,
    });
  };

  if (step === "liability" && createdAssetId !== null) {
    return (
      <CreateLiabilityForm
        assetId={createdAssetId}
        onSuccess={() => {
          toast.success("Ativo e passivo cadastrados!");
          onSuccess();
        }}
        onSkip={() => {
          toast.success("Ativo cadastrado sem passivo.");
          onSuccess();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleAssetSubmit} className="space-y-4">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do Ativo *</Label>
        <Input
          id="name"
          value={assetForm.name}
          onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
          placeholder="Ex: Apartamento Barra, Gol 2020, Terreno..."
          required
        />
      </div>

      {/* Tipo */}
      <div className="space-y-1.5">
        <Label>Tipo de Ativo *</Label>
        <Select
          value={assetForm.assetType}
          onValueChange={(v: any) =>
            setAssetForm({ ...assetForm, assetType: v })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="imovel">🏠 Imóvel</SelectItem>
            <SelectItem value="veiculo">🚗 Veículo</SelectItem>
            <SelectItem value="credito">🏦 Crédito / Empréstimo</SelectItem>
            <SelectItem value="participacao">💼 Participação Societária</SelectItem>
            <SelectItem value="equipamento">📦 Equipamento</SelectItem>
            <SelectItem value="outro">⋯ Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="currentValue">Valor Atual (R$) *</Label>
          <Input
            id="currentValue"
            type="number"
            step="0.01"
            min="0"
            value={assetForm.currentValue}
            onChange={(e) =>
              setAssetForm({ ...assetForm, currentValue: e.target.value })
            }
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acquisitionValue">Valor de Aquisição</Label>
          <Input
            id="acquisitionValue"
            type="number"
            step="0.01"
            min="0"
            value={assetForm.acquisitionValue}
            onChange={(e) =>
              setAssetForm({ ...assetForm, acquisitionValue: e.target.value })
            }
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Data de aquisição */}
      <div className="space-y-1.5">
        <Label htmlFor="acquisitionDate">Data de Aquisição</Label>
        <Input
          id="acquisitionDate"
          type="date"
          value={assetForm.acquisitionDate}
          onChange={(e) =>
            setAssetForm({ ...assetForm, acquisitionDate: e.target.value })
          }
        />
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={assetForm.description}
          onChange={(e) =>
            setAssetForm({ ...assetForm, description: e.target.value })
          }
          placeholder="Endereço, placa, detalhes..."
          rows={2}
        />
      </div>

      {/* Toggle: vincular passivo */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-3 py-3">
        <div>
          <p className="text-sm font-medium">Vincular Financiamento / Passivo</p>
          <p className="text-xs text-muted-foreground">
            Cadastrar parcelas pendentes deste ativo
          </p>
        </div>
        <Switch
          checked={addLiability}
          onCheckedChange={setAddLiability}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={createAsset.isPending}
      >
        {createAsset.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : addLiability ? (
          "Próximo: Cadastrar Passivo →"
        ) : (
          "Cadastrar Ativo"
        )}
      </Button>
    </form>
  );
}

// ─── CreateLiabilityForm ──────────────────────────────────────────────────────

interface CreateLiabilityFormProps {
  assetId?: number;
  onSuccess: () => void;
  onSkip?: () => void;
}

function CreateLiabilityForm({
  assetId,
  onSuccess,
  onSkip,
}: CreateLiabilityFormProps) {
  const [form, setForm] = useState({
    name: "",
    creditor: "",
    originalAmount: "",
    installmentValue: "",
    totalInstallments: "",
    interestRate: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    notes: "",
  });

  const mutation = trpc.patrimonial.createLiability.useMutation({
    onSuccess: () => {
      toast.success("Passivo cadastrado!");
      onSuccess();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      assetId: assetId,
      name: form.name,
      creditor: form.creditor || undefined,
      originalAmount: parseFloat(form.originalAmount),
      installmentValue: form.installmentValue
        ? parseFloat(form.installmentValue)
        : undefined,
      totalInstallments: form.totalInstallments
        ? parseInt(form.totalInstallments)
        : undefined,
      interestRate: form.interestRate
        ? parseFloat(form.interestRate)
        : undefined,
      startDate: new Date(form.startDate),
      endDate: form.endDate ? new Date(form.endDate) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {assetId && (
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-xs text-cyan-400">
          Passivo será vinculado ao ativo cadastrado
        </div>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="liab-name">Nome do Passivo *</Label>
        <Input
          id="liab-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Financiamento CEF, Consórcio..."
          required
        />
      </div>

      {/* Credor */}
      <div className="space-y-1.5">
        <Label htmlFor="creditor">Credor / Banco</Label>
        <Input
          id="creditor"
          value={form.creditor}
          onChange={(e) => setForm({ ...form, creditor: e.target.value })}
          placeholder="Ex: Caixa Econômica, Itaú..."
        />
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="originalAmount">Saldo Devedor (R$) *</Label>
          <Input
            id="originalAmount"
            type="number"
            step="0.01"
            min="0"
            value={form.originalAmount}
            onChange={(e) =>
              setForm({ ...form, originalAmount: e.target.value })
            }
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="installmentValue">Valor da Parcela (R$)</Label>
          <Input
            id="installmentValue"
            type="number"
            step="0.01"
            min="0"
            value={form.installmentValue}
            onChange={(e) =>
              setForm({ ...form, installmentValue: e.target.value })
            }
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Parcelas e juros */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="totalInstallments">Total de Parcelas</Label>
          <Input
            id="totalInstallments"
            type="number"
            min="1"
            value={form.totalInstallments}
            onChange={(e) =>
              setForm({ ...form, totalInstallments: e.target.value })
            }
            placeholder="Ex: 360"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interestRate">Taxa de Juros (% a.a.)</Label>
          <Input
            id="interestRate"
            type="number"
            step="0.01"
            min="0"
            value={form.interestRate}
            onChange={(e) =>
              setForm({ ...form, interestRate: e.target.value })
            }
            placeholder="Ex: 8,5"
          />
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Data de Início *</Label>
          <Input
            id="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Previsão de Término</Label>
          <Input
            id="endDate"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="liab-notes">Observações</Label>
        <Textarea
          id="liab-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Contrato, condições especiais..."
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        {onSkip && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onSkip}
          >
            Pular
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Cadastrar Passivo"
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── RegisterPaymentForm ──────────────────────────────────────────────────────

interface RegisterPaymentFormProps {
  liabilityId: number;
  remainingBalance: number;
  onSuccess: () => void;
}

function RegisterPaymentForm({
  liabilityId,
  remainingBalance,
  onSuccess,
}: RegisterPaymentFormProps) {
  const [form, setForm] = useState({
    amount: remainingBalance > 0
      ? ""
      : "0",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const mutation = trpc.patrimonial.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado!");
      onSuccess();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      liabilityId,
      amount: parseFloat(form.amount),
      paymentDate: new Date(form.paymentDate),
      notes: form.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Saldo atual */}
      <div className="rounded-lg bg-card/50 border border-border/50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Saldo devedor atual</span>
        <span className="text-sm font-mono font-semibold text-red-400">
          {formatCurrency(remainingBalance)}
        </span>
      </div>

      {/* Valor do pagamento */}
      <div className="space-y-1.5">
        <Label htmlFor="pay-amount">Valor do Pagamento (R$) *</Label>
        <Input
          id="pay-amount"
          type="number"
          step="0.01"
          min="0.01"
          max={remainingBalance}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="0,00"
          required
        />
        <p className="text-xs text-muted-foreground">
          Novo saldo após pagamento:{" "}
          <span className="font-mono text-cyan-400">
            {formatCurrency(
              Math.max(0, remainingBalance - (parseFloat(form.amount) || 0))
            )}
          </span>
        </p>
      </div>

      {/* Data */}
      <div className="space-y-1.5">
        <Label htmlFor="pay-date">Data do Pagamento *</Label>
        <Input
          id="pay-date"
          type="date"
          value={form.paymentDate}
          onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
          required
        />
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="pay-notes">Observações</Label>
        <Input
          id="pay-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Referência, mês/ano..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Registrando...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar Pagamento
          </>
        )}
      </Button>
    </form>
  );
}
