import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Trash2, Plus, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

export default function Patrimonio() {
  const { user } = useAuth();
  const { showBalances } = useBalanceVisibility();
  const [activeTab, setActiveTab] = useState("resumo");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Queries
  const { data: summary, isLoading: summaryLoading } = trpc.patrimonial.getSummary.useQuery();
  const { data: assets, isLoading: assetsLoading, refetch: refetchAssets } = trpc.patrimonial.listAssets.useQuery();
  const { data: liabilities, isLoading: liabilitiesLoading, refetch: refetchLiabilities } = trpc.patrimonial.listLiabilities.useQuery();

  // Mutations
  const createAssetMutation = trpc.patrimonial.createAsset.useMutation({
    onSuccess: () => {
      refetchAssets();
      setIsDialogOpen(false);
    },
  });

  const createLiabilityMutation = trpc.patrimonial.createLiability.useMutation({
    onSuccess: () => {
      refetchLiabilities();
      setIsDialogOpen(false);
    },
  });

  const deleteAssetMutation = trpc.patrimonial.deleteAsset.useMutation({
    onSuccess: () => refetchAssets(),
  });

  const registerPaymentMutation = trpc.patrimonial.registerPayment.useMutation({
    onSuccess: () => {
      refetchLiabilities();
      setIsDialogOpen(false);
    },
  });

  if (!user) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Patrimônio</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Controle de ativos imobilizados, créditos e passivos
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Ativos
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${!showBalances ? "blur-sm" : ""}`}>
                {formatCurrency(summary.totalAssets)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.assetCount} ativo{summary.assetCount !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Passivos
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${!showBalances ? "blur-sm" : ""}`}>
                {formatCurrency(summary.totalLiabilities)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.liabilityCount} passivo{summary.liabilityCount !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Patrimônio Líquido
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold font-mono ${!showBalances ? "blur-sm" : ""}`}>
                {formatCurrency(summary.netWorth)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ativos - Passivos
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="passivos">Passivos</TabsTrigger>
        </TabsList>

        {/* Resumo Tab */}
        <TabsContent value="resumo" className="space-y-4">
          {summary && (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(summary.assetsByType).map(([type, value]: [string, number]) => (
                <Card key={type} className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">{type}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold font-mono ${!showBalances ? "blur-sm" : ""}`}>
                      {formatCurrency(value)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ativos Tab */}
        <TabsContent value="ativos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Ativos Patrimoniais</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Ativo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Ativo Patrimonial</DialogTitle>
                </DialogHeader>
                <CreateAssetForm onSuccess={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          {assetsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !assets || assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum ativo registrado</div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset: any) => (
                <Card key={asset.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{asset.name}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{asset.assetType}</p>
                        {asset.description && (
                          <p className="text-sm text-muted-foreground mt-1">{asset.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold font-mono ${!showBalances ? "blur-sm" : ""}`}>
                          {formatCurrency(asset.currentValue)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAssetMutation.mutate({ id: asset.id })}
                          className="text-destructive hover:text-destructive mt-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Passivos Tab */}
        <TabsContent value="passivos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Passivos Patrimoniais</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Passivo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Passivo Patrimonial</DialogTitle>
                </DialogHeader>
                <CreateLiabilityForm onSuccess={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          {liabilitiesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !liabilities || liabilities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum passivo registrado</div>
          ) : (
            <div className="space-y-2">
              {liabilities.map((liability: any) => (
                <Card key={liability.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{liability.name}</h3>
                          {liability.remainingBalance === 0 && (
                            <Badge variant="outline" className="text-emerald-600">
                              Quitado
                            </Badge>
                          )}
                        </div>
                        {liability.creditor && (
                          <p className="text-sm text-muted-foreground">Credor: {liability.creditor}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          Saldo: {formatCurrency(liability.remainingBalance)} / {formatCurrency(parseFloat(liability.originalAmount.toString()))}
                        </p>
                      </div>
                      <div className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Registrar Pagamento
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Registrar Pagamento - {liability.name}</DialogTitle>
                            </DialogHeader>
                            <RegisterPaymentForm liabilityId={liability.id} onSuccess={() => {}} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Form Components
function CreateAssetForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    assetType: "imovel" as const,
    currentValue: 0,
    description: "",
  });

  const mutation = trpc.patrimonial.createAsset.useMutation({
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      currentValue: formData.currentValue,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Ativo</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Casa Jardim Europa"
          required
        />
      </div>
      <div>
        <Label htmlFor="assetType">Tipo</Label>
        <Select value={formData.assetType} onValueChange={(value: any) => setFormData({ ...formData, assetType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="imovel">Imóvel</SelectItem>
            <SelectItem value="veiculo">Veículo</SelectItem>
            <SelectItem value="credito">Crédito</SelectItem>
            <SelectItem value="participacao">Participação</SelectItem>
            <SelectItem value="equipamento">Equipamento</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="currentValue">Valor Atual (R$)</Label>
        <Input
          id="currentValue"
          type="number"
          step="0.01"
          value={formData.currentValue}
          onChange={(e) => setFormData({ ...formData, currentValue: parseFloat(e.target.value) })}
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detalhes adicionais..."
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Salvando..." : "Adicionar Ativo"}
      </Button>
    </form>
  );
}

function CreateLiabilityForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    creditor: "",
    originalAmount: 0,
    startDate: new Date().toISOString().split("T")[0],
  });

  const mutation = trpc.patrimonial.createLiability.useMutation({
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      originalAmount: formData.originalAmount,
      startDate: new Date(formData.startDate),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Passivo</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Financiamento CEF"
          required
        />
      </div>
      <div>
        <Label htmlFor="creditor">Credor</Label>
        <Input
          id="creditor"
          value={formData.creditor}
          onChange={(e) => setFormData({ ...formData, creditor: e.target.value })}
          placeholder="Ex: CEF"
        />
      </div>
      <div>
        <Label htmlFor="originalAmount">Valor Original (R$)</Label>
        <Input
          id="originalAmount"
          type="number"
          step="0.01"
          value={formData.originalAmount}
          onChange={(e) => setFormData({ ...formData, originalAmount: parseFloat(e.target.value) })}
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <Label htmlFor="startDate">Data de Início</Label>
        <Input
          id="startDate"
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          required
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Salvando..." : "Adicionar Passivo"}
      </Button>
    </form>
  );
}

function RegisterPaymentForm({ liabilityId, onSuccess }: { liabilityId: number; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split("T")[0],
  });

  const mutation = trpc.patrimonial.registerPayment.useMutation({
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      liabilityId,
      ...formData,
      amount: formData.amount,
      paymentDate: new Date(formData.paymentDate),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Valor do Pagamento (R$)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <Label htmlFor="paymentDate">Data do Pagamento</Label>
        <Input
          id="paymentDate"
          type="date"
          value={formData.paymentDate}
          onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
          required
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Registrando..." : "Registrar Pagamento"}
      </Button>
    </form>
  );
}
