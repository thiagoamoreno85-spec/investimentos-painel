import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { portfolioData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, ArrowDownRight, Loader2, Wallet, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ASSET_CLASS_LABELS,
  CLASS_CURRENCY,
  classColor,
} from "@/lib/assetClasses";

interface ClassGroup {
  id: string;
  name: string;
  totalValue: number;
  percentage: number;
  assets: {
    id: string;
    name: string;
    position: number;
    cost: number;
    price: number;
    totalValue: number;
    profit: number;
    profitPercentage: number;
    currency: string;
  }[];
}

export default function Alocacao() {
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const { data: cashData } = trpc.cash.getBalance.useQuery();
  const { data: cashMovements } = trpc.cash.listMovements.useQuery({ limit: 8 });
  const usdBrl = usdBrlData?.rate ?? 5.7;
  const hasDbData = dbAssets && dbAssets.length > 0;
  const cashBalance = Number(cashData?.balance ?? 0);
  const [search, setSearch] = useState("");

  const categories: ClassGroup[] = useMemo(() => {
    if (hasDbData) {
      const classMap = new Map<string, ClassGroup>();
      let totalPatrimony = cashBalance; // inclui caixa real no total

      for (const asset of dbAssets!) {
        // Ignorar ativos de classe caixa (agora gerenciados pelo cash_balance)
        if (asset.assetClass === "caixa") continue;

        const qty = parseFloat(asset.totalQuantity);
        const avgCost = parseFloat(asset.averageCost);
        const lastPrice = parseFloat(asset.lastPrice);
        const currency = asset.currency || CLASS_CURRENCY[asset.assetClass] || "BRL";

        let valueBRL = qty * lastPrice;
        let costBRL = qty * avgCost;
        if (currency === "USD") {
          valueBRL *= usdBrl;
          costBRL *= usdBrl;
        }
        totalPatrimony += valueBRL;

        const classId = asset.assetClass;
        const classLabel = ASSET_CLASS_LABELS[classId] || classId;

        if (!classMap.has(classId)) {
          classMap.set(classId, {
            id: classId,
            name: classLabel,
            totalValue: 0,
            percentage: 0,
            assets: [],
          });
        }

        const group = classMap.get(classId)!;
        group.totalValue += valueBRL;

        const profit = valueBRL - costBRL;
        const profitPct = costBRL > 0 ? (profit / costBRL) * 100 : 0;

        group.assets.push({
          id: asset.ticker,
          name: asset.name || asset.ticker,
          position: qty,
          cost: avgCost,
          price: lastPrice,
          totalValue: valueBRL,
          profit,
          profitPercentage: profitPct,
          currency,
        });
      }

      // Adicionar grupo de caixa dinâmico
      classMap.set("caixa", {
        id: "caixa",
        name: "Caixa",
        totalValue: cashBalance,
        percentage: 0,
        assets: [],
      });

      // Calcular percentuais
      const result = Array.from(classMap.values())
        .map((g) => ({
          ...g,
          percentage: totalPatrimony > 0 ? (g.totalValue / totalPatrimony) * 100 : 0,
          assets: g.assets.sort((a, b) => b.totalValue - a.totalValue),
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

      return result;
    }

    // Fallback estático
    return portfolioData.map((cat) => ({
      ...cat,
      assets: cat.assets.map((a) => ({
        ...a,
        currency: CLASS_CURRENCY[cat.id] || "BRL",
      })),
    }));
  }, [hasDbData, dbAssets, usdBrl, cashBalance]);

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

  function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatBRLCompact(value: number) {
    if (value >= 1000) {
      return `R$${(value / 1000).toFixed(1)}k`;
    }
    return formatBRL(value);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Cabeçalho — fixo */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Alocação Detalhada</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Composição da carteira por classe de ativo.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar ativo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card/50"
            />
          </div>
        </div>

        {categories.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum ativo cadastrado. Importe a carteira na página Visão
                Geral ou registre transações.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs
            defaultValue={categories[0]?.id || "rv_nacional"}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Tabs — fixas, com identidade de cor por classe */}
            <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto bg-card/50 border border-border/50 h-auto p-1 flex-nowrap">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-secondary data-[state=active]:text-foreground px-3 py-1.5 text-xs md:text-sm whitespace-nowrap gap-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: classColor(category.id) }}
                    aria-hidden="true"
                  />
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => {
              const filteredAssets = search.trim()
                ? category.assets.filter(
                    (a) =>
                      a.id.toLowerCase().includes(search.trim().toLowerCase()) ||
                      a.name.toLowerCase().includes(search.trim().toLowerCase())
                  )
                : category.assets;

              return (
                <TabsContent
                  key={category.id}
                  value={category.id}
                  className="flex flex-col flex-1 min-h-0 mt-4"
                >
                  <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden">
                    {/* Header do card — fixo, com barra de alocação */}
                    <CardHeader className="flex-shrink-0 px-3 md:px-6 py-3 md:py-4 gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: classColor(category.id) }}
                            aria-hidden="true"
                          />
                          <div>
                            <CardTitle>{category.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {category.percentage.toFixed(1)}% do patrimônio ·{" "}
                              {category.assets.length}{" "}
                              {category.assets.length === 1 ? "ativo" : "ativos"}
                            </p>
                          </div>
                        </div>
                        <div className="text-lg md:text-2xl font-bold font-mono">
                          {formatBRL(category.totalValue)}
                        </div>
                      </div>
                      {/* Barra de participação no patrimônio */}
                      <div className="h-1 rounded-full bg-secondary overflow-hidden" aria-hidden="true">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, category.percentage)}%`,
                            backgroundColor: classColor(category.id),
                          }}
                        />
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-col flex-1 min-h-0 pt-0 px-2 md:px-6 pb-2 md:pb-4">
                      {/* Renderização especial para aba Caixa */}
                      {category.id === "caixa" ? (
                        <div className="space-y-4">
                          {/* Card de saldo real */}
                          <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-emerald-500/10">
                                <Wallet className="h-5 w-5 text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Caixa Disponível</p>
                                <p className="text-2xl font-bold text-emerald-400 font-mono">
                                  {formatBRL(cashBalance)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {cashData?.updatedAt
                                    ? `Atualizado em ${new Date(cashData.updatedAt).toLocaleDateString("pt-BR")}`
                                    : "Saldo real do cash_balance"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">% do patrimônio</p>
                              <p className="text-lg font-semibold font-mono">
                                {category.percentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {/* Últimas movimentações */}
                          {cashMovements && cashMovements.length > 0 ? (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-2">
                                Últimas movimentações
                              </p>
                              <div className="rounded-md border border-border/50 overflow-hidden">
                                <ScrollArea className="max-h-72">
                                  <table className="w-full text-sm">
                                    <thead className="bg-secondary/50 text-muted-foreground">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-xs font-medium">Data</th>
                                        <th className="text-left px-3 py-2 text-xs font-medium hidden sm:table-cell">Categoria</th>
                                        <th className="text-left px-3 py-2 text-xs font-medium">Descrição</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                      {cashMovements.map((m) => (
                                        <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(m.date).toLocaleDateString("pt-BR")}
                                          </td>
                                          <td className="px-3 py-2 text-xs capitalize hidden sm:table-cell">
                                            {String(m.category).replace(/_/g, " ")}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {m.description ?? "—"}
                                          </td>
                                          <td className={`px-3 py-2 text-right text-xs font-mono font-medium ${m.type === "entrada" ? "text-emerald-400" : "text-red-400"}`}>
                                            {m.type === "entrada" ? "+" : "-"}
                                            {formatBRL(Number(m.amount))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </ScrollArea>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              Nenhuma movimentação registrada. Use o card de Caixa na Visão Geral para registrar entradas e saídas.
                            </p>
                          )}
                        </div>
                      ) : filteredAssets.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                          Nenhum ativo encontrado para “{search}”.
                        </p>
                      ) : (
                        /* Tabela única — thead sticky, apenas o corpo rola */
                        <div className="rounded-md border border-border/50 flex flex-col flex-1 min-h-0 overflow-hidden">
                          <ScrollArea className="flex-1 min-h-0">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-secondary text-muted-foreground sticky top-0 z-10">
                                <tr>
                                  <th className="px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm">Ativo</th>
                                  <th className="px-1 md:px-4 py-2 md:py-3 font-medium text-right text-xs md:text-sm">Qtd</th>
                                  <th className="px-1 md:px-4 py-2 md:py-3 font-medium text-right text-xs md:text-sm hidden sm:table-cell">Custo Médio</th>
                                  <th className="px-1 md:px-4 py-2 md:py-3 font-medium text-right text-xs md:text-sm">Preço</th>
                                  <th className="px-1 md:px-4 py-2 md:py-3 font-medium text-right text-xs md:text-sm">Total</th>
                                  <th className="px-1 md:px-4 py-2 md:py-3 font-medium text-right text-xs md:text-sm">L/P</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {filteredAssets.map((asset) => (
                                  <tr
                                    key={asset.id}
                                    className="hover:bg-secondary/20 transition-colors"
                                  >
                                    <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm">
                                      <span className="sm:hidden font-mono">{asset.id}</span>
                                      <span className="hidden sm:inline">{asset.name}</span>
                                    </td>
                                    <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm">
                                      {asset.position < 1
                                        ? asset.position.toFixed(4)
                                        : asset.position % 1 === 0
                                        ? asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                                        : asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm hidden sm:table-cell text-muted-foreground">
                                      {formatCurrency(asset.cost, asset.currency)}
                                    </td>
                                    <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm">
                                      {formatCurrency(asset.price, asset.currency)}
                                    </td>
                                    <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono font-medium text-xs md:text-sm">
                                      <span className="sm:hidden">{formatBRLCompact(asset.totalValue)}</span>
                                      <span className="hidden sm:inline">{formatBRL(asset.totalValue)}</span>
                                    </td>
                                    <td className="px-1 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm">
                                      <div
                                        className={`flex items-center justify-end gap-0.5 font-mono ${
                                          asset.profit >= 0 ? "text-emerald-500" : "text-red-400"
                                        }`}
                                      >
                                        {asset.profit >= 0 ? (
                                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                                        ) : (
                                          <ArrowDownRight className="h-3 w-3 shrink-0" />
                                        )}
                                        <span className="sm:hidden">
                                          {asset.profitPercentage >= 0 ? "+" : ""}
                                          {asset.profitPercentage.toFixed(1)}%
                                        </span>
                                        <span className="hidden sm:inline">
                                          {formatBRL(Math.abs(asset.profit))}
                                          <span className="text-xs ml-1 opacity-80">
                                            ({asset.profitPercentage.toFixed(1)}%)
                                          </span>
                                        </span>
                                      </div>
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
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
