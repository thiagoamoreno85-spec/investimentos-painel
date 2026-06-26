import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { portfolioData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { DEFAULT_USD_BRL_RATE } from "@shared/constants";

const ASSET_CLASS_LABELS: Record<string, string> = {
  rv_nacional: "RV Nacional",
  rv_eua: "RV EUA",
  fundos: "Fundos",
  cripto: "Criptomoedas",
  renda_fixa: "Renda Fixa",
  uranio: "Urânio",
  india: "Índia",
  caixa: "Caixa",
};

const CLASS_CURRENCY: Record<string, string> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
  caixa: "BRL",
};

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
  const usdBrl = usdBrlData?.rate ?? DEFAULT_USD_BRL_RATE;
  const hasDbData = dbAssets && dbAssets.length > 0;
  const cashBalance = Number(cashData?.balance ?? 0);

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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-2">
          <Skeleton className="h-8 w-56" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Layout fixo: header + tabs no topo, apenas a tabela rola */}
      <div className="space-y-6">
        {/* Cabeçalho fixo */}
        <div className="flex-shrink-0 pb-3">
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Alocação Detalhada</h2>
          <p className="text-muted-foreground mt-1">
            Visualize a composição da sua carteira por classe de ativo.
          </p>
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
            {/* Tabs fixas */}
            <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto bg-card/50 border border-border/50 h-auto p-1 flex-nowrap">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-1.5 text-xs md:text-sm whitespace-nowrap"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className="flex flex-col flex-1 min-h-0 mt-4"
              >
                <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                  {/* Header do card fixo */}
                  <CardHeader className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 md:px-6 py-3 md:py-4">
                    <div>
                      <CardTitle>{category.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.percentage.toFixed(1)}% do patrimônio total
                      </p>
                    </div>
                    <div className="text-lg md:text-2xl font-bold font-mono">
                      {formatBRL(category.totalValue)}
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 min-h-0 pt-0 px-2 md:px-6">
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
                    ) : (
                      /* Tabela padrão para outras classes — versão mobile-first */
                      <div className="rounded-md border border-border/50 flex flex-col flex-1 min-h-0 overflow-hidden">
                        {/* Cabeçalho da tabela fixo */}
                        <div className="flex-shrink-0">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground">
                              <tr>
                                <th className="px-2 md:px-4 py-2 font-medium text-xs">Ativo</th>
                                <th className="px-1 md:px-4 py-2 font-medium text-right text-xs">Qtd</th>
                                <th className="px-1 md:px-4 py-2 font-medium text-right text-xs hidden sm:table-cell">Custo Médio</th>
                                <th className="px-1 md:px-4 py-2 font-medium text-right text-xs">Preço</th>
                                <th className="px-1 md:px-4 py-2 font-medium text-right text-xs">Total</th>
                                <th className="px-1 md:px-4 py-2 font-medium text-right text-xs">L/P</th>
                              </tr>
                            </thead>
                          </table>
                        </div>
                        {/* Corpo da tabela com scroll */}
                        <ScrollArea className="flex-1 min-h-0">
                          <table className="w-full text-sm text-left">
                            <tbody className="divide-y divide-border/50">
                              {category.assets.map((asset) => (
                                <tr
                                  key={asset.id}
                                  className="hover:bg-secondary/20 transition-colors"
                                >
                                  {/* Ativo: ticker curto em mobile, nome completo em desktop */}
                                  <td className="px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm">
                                    <span className="sm:hidden">{asset.id}</span>
                                    <span className="hidden sm:inline">{asset.name}</span>
                                  </td>
                                  {/* Qtd: sem decimais se inteiro em mobile */}
                                  <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm">
                                    {asset.position < 1
                                      ? asset.position.toFixed(4)
                                      : asset.position % 1 === 0
                                      ? asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                                      : asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                                  </td>
                                  {/* Custo Médio: oculto em mobile */}
                                  <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm hidden sm:table-cell">
                                    {formatCurrency(asset.cost, asset.currency)}
                                  </td>
                                  {/* Preço: compacto */}
                                  <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono text-xs md:text-sm">
                                    {formatCurrency(asset.price, asset.currency)}
                                  </td>
                                  {/* Total: formato compacto em mobile (R$74.8k) */}
                                  <td className="px-1 md:px-4 py-2 md:py-3 text-right font-mono font-medium text-xs md:text-sm">
                                    <span className="sm:hidden">
                                      {asset.totalValue >= 1000
                                        ? `R$${(asset.totalValue / 1000).toFixed(1)}k`
                                        : formatBRL(asset.totalValue)}
                                    </span>
                                    <span className="hidden sm:inline">
                                      {formatBRL(asset.totalValue)}
                                    </span>
                                  </td>
                                  {/* L/P: apenas % em mobile, valor + % em desktop */}
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
                                      {/* Mobile: só percentual */}
                                      <span className="sm:hidden">
                                        {asset.profitPercentage >= 0 ? "+" : ""}{asset.profitPercentage.toFixed(1)}%
                                      </span>
                                      {/* Desktop: valor + percentual */}
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
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
