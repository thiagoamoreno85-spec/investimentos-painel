import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import DashboardLayout from "@/components/DashboardLayout";
import { ImportCSVModal } from "@/components/ImportCSVModal";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const ASSET_CLASSES = [
  { value: "rv_nacional", label: "RV Nacional" },
  { value: "rv_eua", label: "RV EUA" },
  { value: "fundos", label: "Fundos" },
  { value: "cripto", label: "Criptomoedas" },
  { value: "renda_fixa", label: "Renda Fixa" },
  { value: "uranio", label: "Urânio" },
  { value: "india", label: "Índia" },
  { value: "caixa", label: "Caixa" },
] as const;

const CLASS_CURRENCY: Record<string, "BRL" | "USD"> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
  caixa: "BRL",
};

export default function Transacoes() {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<string>("rv_nacional");
  const [txType, setTxType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: assets, isLoading: assetsLoading } =
    trpc.portfolio.getAssets.useQuery();
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const { data: allTransactions, isLoading: txLoading } =
    trpc.portfolio.getTransactions.useQuery();
  const transactions = (allTransactions ?? []).slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.max(1, Math.ceil((allTransactions?.length ?? 0) / LIMIT));

  const addTx = trpc.portfolio.addTransaction.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Transação registrada! Preço médio: ${formatCurrency(
          result.averageCost,
          CLASS_CURRENCY[assetClass] || "BRL"
        )}`
      );
      utils.portfolio.getAssets.invalidate();
      utils.portfolio.getTransactions.invalidate();
      // Reset form
      setTicker("");
      setName("");
      setQuantity("");
      setUnitPrice("");
      setFees("0");
      setNotes("");
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const deleteTx = trpc.portfolio.deleteTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transação removida e preço médio recalculado.");
      utils.portfolio.getAssets.invalidate();
      utils.portfolio.getTransactions.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const refreshPrices = trpc.portfolio.refreshPrices.useMutation({
    onSuccess: (result) => {
      toast.success(
        `${result.updated} cotações atualizadas. USD/BRL: R$ ${result.usdBrl.toFixed(2)}`
      );
      utils.portfolio.getAssets.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar cotações: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice);
    const fee = parseFloat(fees || "0");

    if (!ticker || !name || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
      toast.error("Preencha todos os campos obrigatórios corretamente.");
      return;
    }

    addTx.mutate({
      ticker: ticker.toUpperCase().trim(),
      name: name.trim(),
      assetClass: assetClass as any,
      currency: CLASS_CURRENCY[assetClass] || "BRL",
      type: txType,
      quantity: qty,
      unitPrice: price,
      fees: fee,
      transactionDate: new Date(txDate + "T12:00:00Z"),
      notes: notes || undefined,
    });
  }

  // Selecionar ativo existente
  function selectExistingAsset(asset: any) {
    setTicker(asset.ticker);
    setName(asset.name || asset.ticker);
    setAssetClass(asset.assetClass);
  }

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    let filtered = [...transactions];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((tx) => {
        const asset = assets?.find((a) => a.id === tx.assetId);
        return (
          asset?.ticker.toLowerCase().includes(term) ||
          asset?.name.toLowerCase().includes(term)
        );
      });
    }
    return filtered;
  }, [transactions, searchTerm, assets]);

  function formatCurrency(value: number, currency: string = "BRL") {
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("pt-BR");
  }

  function getAssetTicker(assetId: number) {
    return assets?.find((a) => a.id === assetId)?.ticker || "—";
  }

  function getAssetCurrency(assetId: number) {
    const asset = assets?.find((a) => a.id === assetId);
    return asset?.currency || "BRL";
  }

  // Resumo por ativo
  const assetSummary = useMemo(() => {
    if (!assets) return [];
    return assets
      .filter((a) => parseFloat(a.totalQuantity) > 0)
      .sort((a, b) => {
        const valA = parseFloat(a.totalQuantity) * parseFloat(a.lastPrice);
        const valB = parseFloat(b.totalQuantity) * parseFloat(b.lastPrice);
        return valB - valA;
      });
  }, [assets]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho fixo */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Transações</h2>
            <p className="text-muted-foreground mt-1">
              Registre compras e vendas de ativos. O preço médio é calculado
              automaticamente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshPrices.mutate()}
              disabled={refreshPrices.isPending}
              className="gap-2"
            >
              {refreshPrices.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Atualizar Cotações
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-3 flex-1 min-h-0">
          {/* Formulário de Transação */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nova Transação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={txType === "buy" ? "default" : "outline"}
                    onClick={() => setTxType("buy")}
                    className={`gap-2 ${
                      txType === "buy"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : ""
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Compra
                  </Button>
                  <Button
                    type="button"
                    variant={txType === "sell" ? "default" : "outline"}
                    onClick={() => setTxType("sell")}
                    className={`gap-2 ${
                      txType === "sell"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : ""
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Venda
                  </Button>
                </div>

                {/* Ativo existente */}
                {assets && assets.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Selecionar ativo existente
                    </Label>
                    <Select
                      value=""
                      onValueChange={(val) => {
                        const asset = assets.find(
                          (a) => a.ticker === val
                        );
                        if (asset) selectExistingAsset(asset);
                      }}
                    >
                      <SelectTrigger className="bg-secondary/50 border-border">
                        <SelectValue placeholder="Escolher ativo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((a) => (
                          <SelectItem key={a.id} value={a.ticker}>
                            {a.ticker} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Ticker */}
                <div>
                  <Label htmlFor="ticker">Ticker *</Label>
                  <Input
                    id="ticker"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="Ex: VALE3, MSFT, BTC"
                    className="bg-secondary/50 border-border"
                    required
                  />
                </div>

                {/* Nome */}
                <div>
                  <Label htmlFor="name">Nome do Ativo *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Vale S.A."
                    className="bg-secondary/50 border-border"
                    required
                  />
                </div>

                {/* Classe */}
                <div>
                  <Label>Classe do Ativo</Label>
                  <Select value={assetClass} onValueChange={setAssetClass}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CLASSES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantidade e Preço */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="bg-secondary/50 border-border font-mono"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="unitPrice">
                      Preço Unit. ({CLASS_CURRENCY[assetClass] || "BRL"}) *
                    </Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      step="any"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-secondary/50 border-border font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Total calculado */}
                {quantity && unitPrice && (
                  <div className="p-3 rounded-md bg-secondary/30 border border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Total da operação
                    </p>
                    <p className="text-lg font-bold font-mono">
                      {formatCurrency(
                        parseFloat(quantity) * parseFloat(unitPrice),
                        CLASS_CURRENCY[assetClass] || "BRL"
                      )}
                    </p>
                  </div>
                )}

                {/* Taxas */}
                <div>
                  <Label htmlFor="fees">Taxas / Corretagem</Label>
                  <Input
                    id="fees"
                    type="number"
                    step="any"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0.00"
                    className="bg-secondary/50 border-border font-mono"
                  />
                </div>

                {/* Data */}
                <div>
                  <Label htmlFor="txDate">Data da Transação</Label>
                  <Input
                    id="txDate"
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                </div>

                {/* Notas */}
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
                  className="w-full gap-2"
                  disabled={addTx.isPending}
                >
                  {addTx.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Registrar{" "}
                  {txType === "buy" ? "Compra" : "Venda"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Resumo por Ativo + Histórico */}
          <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
            {/* Resumo dos Ativos — flex-1 com scroll interno */}
            <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Posições Atuais</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 min-h-0 pt-0">
                {assetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : assetSummary.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Nenhum ativo cadastrado. Registre sua primeira transação
                      ou importe a carteira.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border border-border/50">
                    {/* Cabeçalho fixo */}
                    <div className="flex-shrink-0">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-2 px-2">Ticker</th>
                            <th className="text-left py-2 px-2 hidden sm:table-cell">Classe</th>
                            <th className="text-right py-2 px-2">Qtd</th>
                            <th className="text-right py-2 px-2">PM</th>
                            <th className="text-right py-2 px-2">Último</th>
                            <th className="text-right py-2 px-2">Valor</th>
                            <th className="text-right py-2 px-2">Lucro</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    {/* Corpo com scroll */}
                    <ScrollArea className="flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <tbody>
                        {assetSummary.map((asset) => {
                          const qty = parseFloat(asset.totalQuantity);
                          const avgCost = parseFloat(asset.averageCost);
                          const lastPrice = parseFloat(asset.lastPrice);
                          const totalValue = qty * lastPrice;
                          const totalCost = qty * avgCost;
                          const profit = totalValue - totalCost;
                          const profitPct =
                            totalCost > 0
                              ? ((profit / totalCost) * 100)
                              : 0;
                          const currency = asset.currency || "BRL";
                          const classLabel =
                            ASSET_CLASSES.find(
                              (c) => c.value === asset.assetClass
                            )?.label || asset.assetClass;

                          return (
                            <tr
                              key={asset.id}
                              className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="py-2 px-2 font-medium">
                                {asset.ticker}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground text-xs hidden sm:table-cell">
                                {classLabel}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {qty < 1 ? qty.toFixed(6) : qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {formatCurrency(avgCost, currency)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {lastPrice > 0
                                  ? formatCurrency(lastPrice, currency)
                                  : "—"}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {formatCurrency(totalValue, currency)}
                              </td>
                              <td
                                className={`py-2 px-2 text-right font-mono text-xs ${
                                  profit >= 0
                                    ? "text-emerald-500"
                                    : "text-red-400"
                                }`}
                              >
                                {profitPct >= 0 ? "+" : ""}
                                {profitPct.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Transações — fixo abaixo */}
            <Card className="flex-shrink-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle>Histórico de Transações</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar ticker..."
                      className="pl-9 bg-secondary/50 border-border w-full sm:w-48"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {txLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Nenhuma transação registrada ainda.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-left py-2 px-2">Ticker</th>
                          <th className="text-center py-2 px-2">Tipo</th>
                          <th className="text-right py-2 px-2">Qtd</th>
                          <th className="text-right py-2 px-2">Preço</th>
                          <th className="text-right py-2 px-2">Total</th>
                          <th className="text-center py-2 px-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx) => {
                          const currency = getAssetCurrency(tx.assetId);
                          return (
                            <tr
                              key={tx.id}
                              className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="py-2 px-2 text-xs text-muted-foreground">
                                {formatDate(tx.transactionDate)}
                              </td>
                              <td className="py-2 px-2 font-medium text-xs">
                                {getAssetTicker(tx.assetId)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    tx.type === "buy"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-red-500/10 text-red-400"
                                  }`}
                                >
                                  {tx.type === "buy" ? (
                                    <>
                                      <ArrowDownRight className="w-3 h-3" />C
                                    </>
                                  ) : (
                                    <>
                                      <ArrowUpRight className="w-3 h-3" />V
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {parseFloat(tx.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {formatCurrency(parseFloat(tx.unitPrice), currency)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {formatCurrency(parseFloat(tx.totalValue), currency)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    deleteTx.mutate({
                                      transactionId: tx.id,
                                      assetId: tx.assetId,
                                    })
                                  }
                                  disabled={deleteTx.isPending}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >Anterior</Button>
                        <span className="text-xs text-muted-foreground">Pág. {page} / {totalPages}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >Próxima</Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} />
    </DashboardLayout>
  );
}
