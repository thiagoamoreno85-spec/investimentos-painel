import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Building2,
  Landmark,
  Scale,
  Trash2,
  Plus,
  Receipt,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ASSET_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  imovel: { label: "Imóvel", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  veiculo: { label: "Veículo", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  credito: { label: "Crédito", badge: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  participacao: { label: "Participação", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  equipamento: { label: "Equipamento", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  outro: { label: "Outro", badge: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const today = () => new Date().toISOString().split("T")[0];

const num = (s: string): number | undefined => {
  if (!s.trim()) return undefined;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) || n < 0 ? undefined : n;
};

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Patrimonio() {
  const { showBalances } = useBalanceVisibility();
  const utils = trpc.useUtils();
  const blur = !showBalances ? "blur-sm select-none" : "";

  // Queries
  const { data: summary } = trpc.patrimonial.getSummary.useQuery();
  const { data: assets = [], isLoading: assetsLoading } = trpc.patrimonial.listAssets.useQuery();
  const { data: liabilities = [], isLoading: liabilitiesLoading } =
    trpc.patrimonial.listLiabilities.useQuery();

  const invalidateAll = () => {
    utils.patrimonial.getSummary.invalidate();
    utils.patrimonial.listAssets.invalidate();
    utils.patrimonial.listLiabilities.invalidate();
    utils.patrimonial.getConsolidatedNetWorth.invalidate();
  };

  // Dialog states
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    id: number;
    name: string;
    installmentValue: number | null;
    nextInstallment: number;
  } | null>(null);

  // Mutations
  const deleteAsset = trpc.patrimonial.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("Ativo removido");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const activeLiabilities = liabilities.filter((l: any) => l.isActive === 1);
  const settledLiabilities = liabilities.filter((l: any) => l.isActive !== 1);

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header — padrão da plataforma */}
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Patrimônio</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Ativos imobilizados, créditos, passivos e patrimônio líquido consolidado.
          </p>
        </div>

        {/* ── Cards de Resumo ── */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Ativos Patrimoniais
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className={`text-base md:text-2xl font-bold font-mono tracking-tighter truncate ${blur}`}>
                {formatBRL(summary?.totalAssets ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.assetCount ?? 0} {(summary?.assetCount ?? 0) === 1 ? "ativo" : "ativos"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Passivos Totais
              </CardTitle>
              <Landmark className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className={`text-base md:text-2xl font-bold font-mono tracking-tighter truncate text-red-400 ${blur}`}>
                -{formatBRL(summary?.totalLiabilities ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.liabilityCount ?? 0}{" "}
                {(summary?.liabilityCount ?? 0) === 1 ? "passivo" : "passivos"}
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1 bg-card/50 backdrop-blur-sm border-primary/30 shadow-sm card-interactive relative overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"
              aria-hidden="true"
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6 relative">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Patrimônio Líquido
              </CardTitle>
              <Scale className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6 relative">
              <div className={`text-base md:text-2xl font-bold font-mono tracking-tighter truncate text-gradient-hero ${blur}`}>
                {formatBRL(summary?.netWorth ?? 0)}
              </div>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ativos − Passivos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs — padrão pill da plataforma ── */}
        <Tabs defaultValue="ativos">
          <TabsList className="w-full justify-start overflow-x-auto bg-card/50 border border-border/50 h-auto p-1 flex-nowrap">
            <TabsTrigger value="ativos" className="px-3 py-1.5 text-xs md:text-sm">
              Ativos
            </TabsTrigger>
            <TabsTrigger value="passivos" className="px-3 py-1.5 text-xs md:text-sm">
              Passivos
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Ativos ── */}
          <TabsContent value="ativos" className="mt-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Ativos Patrimoniais</CardTitle>
                <Button size="sm" onClick={() => setAssetDialogOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Novo Ativo
                </Button>
              </CardHeader>
              <CardContent>
                {assetsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : assets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum ativo patrimonial cadastrado. Clique em "+ Novo Ativo" para começar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assets.map((a: any) => {
                      const cfg = ASSET_TYPE_CONFIG[a.assetType] ?? ASSET_TYPE_CONFIG.outro;
                      const hasDebt = (a.linkedDebt ?? 0) > 0;
                      return (
                        <div
                          key={a.id}
                          className="p-3 md:p-4 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cfg.badge}`}
                                >
                                  {cfg.label}
                                </span>
                                <p className="font-medium truncate">{a.name}</p>
                              </div>
                              {a.description && (
                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                  {a.description}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                if (confirm(`Remover o ativo "${a.name}"?`))
                                  deleteAsset.mutate({ id: a.id });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Valor atual</p>
                              <p className={`font-mono font-medium ${blur}`}>
                                {formatBRL(a.currentValue)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dívida vinculada</p>
                              <p className={`font-mono font-medium ${hasDebt ? "text-red-400" : "text-muted-foreground"} ${blur}`}>
                                {hasDebt ? `-${formatBRL(a.linkedDebt)}` : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Valor líquido</p>
                              <p className={`font-mono font-bold ${a.netValue >= 0 ? "text-emerald-500" : "text-red-400"} ${blur}`}>
                                {formatBRL(a.netValue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Passivos ── */}
          <TabsContent value="passivos" className="mt-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Passivos e Financiamentos</CardTitle>
                <Button size="sm" onClick={() => setLiabilityDialogOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Novo Passivo
                </Button>
              </CardHeader>
              <CardContent>
                {liabilitiesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : liabilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum passivo cadastrado. Você também pode cadastrar um passivo junto com o
                    ativo, no formulário "+ Novo Ativo".
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeLiabilities.map((l: any) => {
                      const progress =
                        l.totalInstallments && l.totalInstallments > 0
                          ? Math.min(100, (l.paidInstallments / l.totalInstallments) * 100)
                          : l.originalAmount > 0
                          ? Math.min(
                              100,
                              ((l.originalAmount - l.remainingBalance) / l.originalAmount) * 100
                            )
                          : 0;
                      return (
                        <div
                          key={l.id}
                          className="p-3 md:p-4 rounded-lg border border-border/50 bg-secondary/20"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{l.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {l.creditor && <>{l.creditor} · </>}
                                {l.linkedAssetName && <>vinculado a {l.linkedAssetName}</>}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs shrink-0"
                              onClick={() =>
                                setPaymentTarget({
                                  id: l.id,
                                  name: l.name,
                                  installmentValue: l.installmentValue,
                                  nextInstallment: (l.paidInstallments ?? 0) + 1,
                                })
                              }
                            >
                              <Receipt className="w-3 h-3" /> Dar Baixa
                            </Button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Valor original</p>
                              <p className={`font-mono font-medium ${blur}`}>
                                {formatBRL(l.originalAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Saldo devedor</p>
                              <p className={`font-mono font-medium text-red-400 ${blur}`}>
                                {formatBRL(l.remainingBalance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Parcela</p>
                              <p className={`font-mono font-medium ${blur}`}>
                                {l.installmentValue !== null ? formatBRL(l.installmentValue) : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Parcelas pagas</p>
                              <p className="font-mono font-medium">
                                {l.paidInstallments}
                                {l.totalInstallments ? `/${l.totalInstallments}` : ""}
                              </p>
                            </div>
                          </div>

                          {/* Barra de progresso das parcelas */}
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Passivos quitados */}
                    {settledLiabilities.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Quitados
                        </p>
                        {settledLiabilities.map((l: any) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 mb-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <p className="text-sm font-medium truncate">{l.name}</p>
                            </div>
                            <span className={`text-xs font-mono text-muted-foreground ${blur}`}>
                              {formatBRL(l.originalAmount)} quitado
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ── */}
      <AssetFormDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        onDone={invalidateAll}
      />
      <LiabilityFormDialog
        open={liabilityDialogOpen}
        onOpenChange={setLiabilityDialogOpen}
        onDone={invalidateAll}
        assets={assets}
      />
      <PaymentDialog
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onDone={invalidateAll}
      />
    </DashboardLayout>
  );
}

// ─── Dialog: Novo Ativo (com passivo embutido opcional) ──────────────────────

function AssetFormDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("imovel");
  const [currentValue, setCurrentValue] = useState("");
  const [acquisitionValue, setAcquisitionValue] = useState("");
  const [description, setDescription] = useState("");
  // Passivo embutido
  const [hasLiability, setHasLiability] = useState(false);
  const [creditor, setCreditor] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [remainingBalance, setRemainingBalance] = useState("");
  const [installmentValue, setInstallmentValue] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [paidInstallments, setPaidInstallments] = useState("0");
  const [saving, setSaving] = useState(false);

  const createAsset = trpc.patrimonial.createAsset.useMutation();
  const createLiability = trpc.patrimonial.createLiability.useMutation();

  function reset() {
    setName("");
    setAssetType("imovel");
    setCurrentValue("");
    setAcquisitionValue("");
    setDescription("");
    setHasLiability(false);
    setCreditor("");
    setOriginalAmount("");
    setRemainingBalance("");
    setInstallmentValue("");
    setTotalInstallments("");
    setPaidInstallments("0");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = num(currentValue);
    if (!name.trim() || value === undefined || value <= 0) {
      toast.error("Nome e valor atual (positivo) são obrigatórios.");
      return;
    }

    let liabilityPayload: {
      original: number;
      remaining: number | undefined;
      installment: number | undefined;
      total: number | undefined;
      paid: number;
    } | null = null;

    if (hasLiability) {
      const original = num(originalAmount);
      if (original === undefined || original <= 0) {
        toast.error("Informe o valor original do financiamento.");
        return;
      }
      liabilityPayload = {
        original,
        remaining: num(remainingBalance),
        installment: num(installmentValue),
        total: totalInstallments ? parseInt(totalInstallments) : undefined,
        paid: paidInstallments ? parseInt(paidInstallments) : 0,
      };
    }

    setSaving(true);
    try {
      // 1) Cria o ativo
      const asset = await createAsset.mutateAsync({
        name: name.trim(),
        assetType: assetType as any,
        currentValue: value,
        acquisitionValue: num(acquisitionValue),
        description: description.trim() || undefined,
      });

      // 2) Se tem financiamento, cria o passivo já vinculado ao ativo
      if (liabilityPayload) {
        await createLiability.mutateAsync({
          assetId: asset.id,
          name: `Financiamento — ${name.trim()}`,
          creditor: creditor.trim() || undefined,
          originalAmount: liabilityPayload.original,
          remainingBalance: liabilityPayload.remaining,
          installmentValue: liabilityPayload.installment,
          totalInstallments: liabilityPayload.total,
          paidInstallments: liabilityPayload.paid,
          startDate: new Date(),
        });
        toast.success("Ativo e financiamento cadastrados — parcelas prontas para baixa mensal.");
      } else {
        toast.success("Ativo cadastrado.");
      }

      reset();
      onOpenChange(false);
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Ativo Patrimonial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <Label htmlFor="asset-type">Tipo</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger id="asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="asset-name">Nome</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Casa Jardim Europa"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="asset-value">Valor atual (R$)</Label>
              <Input
                id="asset-value"
                type="number"
                min="0"
                step="0.01"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="asset-acq">Valor de aquisição (R$)</Label>
              <Input
                id="asset-acq"
                type="number"
                min="0"
                step="0.01"
                value={acquisitionValue}
                onChange={(e) => setAcquisitionValue(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="asset-desc">Descrição</Label>
            <Textarea
              id="asset-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
              rows={2}
            />
          </div>

          {/* ── Passivo embutido ── */}
          <label className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/30 cursor-pointer">
            <input
              type="checkbox"
              checked={hasLiability}
              onChange={(e) => setHasLiability(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="text-sm">
              Este ativo possui financiamento / parcelas pendentes
            </span>
          </label>

          {hasLiability && (
            <div className="space-y-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Dados do financiamento (passivo vinculado)
              </p>
              <div>
                <Label htmlFor="liab-creditor">Credor</Label>
                <Input
                  id="liab-creditor"
                  value={creditor}
                  onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Ex: Caixa Econômica Federal"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="liab-original">Valor original (R$)</Label>
                  <Input
                    id="liab-original"
                    type="number"
                    min="0"
                    step="0.01"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="liab-remaining">Saldo devedor atual (R$)</Label>
                  <Input
                    id="liab-remaining"
                    type="number"
                    min="0"
                    step="0.01"
                    value={remainingBalance}
                    onChange={(e) => setRemainingBalance(e.target.value)}
                    placeholder="= original se vazio"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="liab-installment">Parcela (R$)</Label>
                  <Input
                    id="liab-installment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentValue}
                    onChange={(e) => setInstallmentValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="liab-total">Total parcelas</Label>
                  <Input
                    id="liab-total"
                    type="number"
                    min="1"
                    step="1"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="liab-paid">Já pagas</Label>
                  <Input
                    id="liab-paid"
                    type="number"
                    min="0"
                    step="1"
                    value={paidInstallments}
                    onChange={(e) => setPaidInstallments(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {hasLiability ? "Cadastrar Ativo + Financiamento" : "Cadastrar Ativo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Novo Passivo avulso ──────────────────────────────────────────────

function LiabilityFormDialog({
  open,
  onOpenChange,
  onDone,
  assets,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  assets: any[];
}) {
  const [name, setName] = useState("");
  const [creditor, setCreditor] = useState("");
  const [assetId, setAssetId] = useState("none");
  const [originalAmount, setOriginalAmount] = useState("");
  const [remainingBalance, setRemainingBalance] = useState("");
  const [installmentValue, setInstallmentValue] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [paidInstallments, setPaidInstallments] = useState("0");
  const [startDate, setStartDate] = useState(today());

  const mutation = trpc.patrimonial.createLiability.useMutation({
    onSuccess: () => {
      toast.success("Passivo cadastrado.");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const original = num(originalAmount);
    if (!name.trim() || original === undefined || original <= 0) {
      toast.error("Nome e valor original (positivo) são obrigatórios.");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      creditor: creditor.trim() || undefined,
      assetId: assetId !== "none" ? parseInt(assetId) : undefined,
      originalAmount: original,
      remainingBalance: num(remainingBalance),
      installmentValue: num(installmentValue),
      totalInstallments: totalInstallments ? parseInt(totalInstallments) : undefined,
      paidInstallments: paidInstallments ? parseInt(paidInstallments) : 0,
      startDate: new Date(startDate + "T00:00:00"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Passivo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <Label htmlFor="lb-name">Nome</Label>
            <Input
              id="lb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Financiamento Imóvel Rua X"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lb-creditor">Credor</Label>
              <Input
                id="lb-creditor"
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Banco/pessoa"
              />
            </div>
            <div>
              <Label htmlFor="lb-asset">Ativo vinculado</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger id="lb-asset">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lb-original">Valor original (R$)</Label>
              <Input
                id="lb-original"
                type="number"
                min="0"
                step="0.01"
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lb-remaining">Saldo devedor atual (R$)</Label>
              <Input
                id="lb-remaining"
                type="number"
                min="0"
                step="0.01"
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(e.target.value)}
                placeholder="= original se vazio"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="lb-installment">Parcela (R$)</Label>
              <Input
                id="lb-installment"
                type="number"
                min="0"
                step="0.01"
                value={installmentValue}
                onChange={(e) => setInstallmentValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lb-total">Total parcelas</Label>
              <Input
                id="lb-total"
                type="number"
                min="1"
                step="1"
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lb-paid">Já pagas</Label>
              <Input
                id="lb-paid"
                type="number"
                min="0"
                step="1"
                value={paidInstallments}
                onChange={(e) => setPaidInstallments(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lb-start">Data de início</Label>
            <Input
              id="lb-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cadastrar Passivo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Dar Baixa ────────────────────────────────────────────────────────

function PaymentDialog({
  target,
  onClose,
  onDone,
}: {
  target: { id: number; name: string; installmentValue: number | null; nextInstallment: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [installment, setInstallment] = useState("");

  // Pré-preencher ao abrir para um novo alvo
  const [lastTargetId, setLastTargetId] = useState<number | null>(null);
  if (target && target.id !== lastTargetId) {
    setLastTargetId(target.id);
    setAmount(target.installmentValue !== null ? String(target.installmentValue) : "");
    setInstallment(String(target.nextInstallment));
    setDate(today());
  }

  const mutation = trpc.patrimonial.registerPayment.useMutation({
    onSuccess: (r) => {
      toast.success(
        r.newBalance <= 0
          ? "Parcela registrada — passivo quitado! 🎉"
          : `Parcela registrada. Saldo devedor: ${formatBRL(r.newBalance)}`
      );
      onClose();
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const value = num(amount);
    if (value === undefined || value <= 0) {
      toast.error("Valor do pagamento inválido.");
      return;
    }
    mutation.mutate({
      liabilityId: target.id,
      amount: value,
      paymentDate: new Date(date + "T00:00:00"),
      installmentNumber: installment ? parseInt(installment) : undefined,
    });
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Dar Baixa — {target?.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="pay-amount">Valor pago (R$)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="pay-installment">Nº da parcela</Label>
              <Input
                id="pay-installment"
                type="number"
                min="1"
                step="1"
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pay-date">Data do pagamento</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Baixa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
