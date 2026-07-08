import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { portfolioData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Wallet,
  Search,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
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
  const { showBalances, toggleShowBalances } = useBalanceVisibility();
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const { data: cashData } = trpc.cash.getBalance.useQuery();
  const { data: cashMovements } = trpc.cash.listMovements.useQuery({ limit: 8 });
  const { data: dailyChangeData } = trpc.portfolio.getAssetsDailyChange.useQuery();
  const usdBrl = usdBrlData?.rate ?? 5.7;
  const hasDbData = dbAssets && dbAssets.length > 0;
  const cashBalance = Number(cashData?.balance ?? 0);
  const [search, setSearch] = useState("");

  const categories: ClassGroup[] = useMemo(() => {
    if (hasDbData) {
      const classMap = new Map<string, ClassGroup>();
      let totalPatrimony = cashBalance;

      for (const asset of dbAssets!) {
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

      classMap.set("caixa", {
        id: "caixa",
        name: "Caixa",
        totalValue: cashBalance,
        percentage: 0,
        assets: [],
      });

      const result = Array.from(classMap.values())
        .map((g) => ({
          ...g,
          percentage: totalPatrimony > 0 ? (g.totalValue / totalPatrimony) * 100 : 0,
          assets: g.assets.sort((a, b) => b.totalValue - a.totalValue),
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

      return result;
    }

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
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1000) return `${sign}R$${(abs / 1000).toFixed(1)}k`;
    return formatBRL(value);
  }

  function formatPct(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  // Helpers para rentabilidade diária por ativo
  const byTicker = dailyChangeData?.byTicker ?? {};

  function getDailyChange(ticker: string): { changeBRL: number; changePct: number } | null {
    const d = byTicker[ticker];
    if (!d) return null;
    return d;
  }

  // Total diário por classe (soma dos changeBRL dos ativos da classe)
  function getClassDailyTotal(assets: ClassGroup["assets"]): number {
    return assets.reduce((sum, a) => {
      const d = getDailyChange(a.id);
      return sum + (d?.changeBRL ?? 0);
    }, 0);
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
      {/* Tela fixa: flex-col ocupando 100% da altura disponível */}
      <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 overflow-hidden">

        {/* ── Cabeçalho fixo ── */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Alocação Detalhada</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Composição da carteira por classe de ativo.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleShowBalances}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              title={showBalances ? "Ocultar valores" : "Mostrar valores"}
            >
              {showBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{showBalances ? "Ocultar" : "Mostrar"}</span>
            </Button>
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
        </div>

        {categories.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum ativo cadastrado. Importe a carteira na página Visão Geral ou registre transações.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Tabs ocupa o restante da altura */
          <Tabs
            defaultValue={categories[0]?.id || "rv_nacional"}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* ── Tabs fixas ── */}
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

              const classDailyTotal = getClassDailyTotal(category.assets);
              const classDailyPct =
                category.totalValue > 0
                  ? (classDailyTotal / category.totalValue) * 100
                  : 0;

              return (
                <TabsContent
                  key={category.id}
                  value={category.id}
                  className="flex flex-col flex-1 min-h-0 mt-3"
                >
                  {/* Card ocupa toda a altura restante */}
                  <Card className="flex flex-col flex-1 min-h-0 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm overflow-hidden">

                    {/* ── Header fixo do card ── */}
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
                        <div className={`text-lg md:text-2xl font-bold font-mono transition-all duration-200 ${!showBalances ? "blur-md select-none" : ""}`}>
                          {formatBRL(category.totalValue)}
                        </div>
                      </div>
                      {/* Barra de participação */}
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

                    {/* ── Conteúdo: tabela scrollável + rodapé fixo ── */}
                    <CardContent className="flex flex-col flex-1 min-h-0 pt-0 px-0 pb-0 overflow-hidden">

                      {/* Caixa especial */}
                      {category.id === "caixa" ? (
                        <ScrollArea className="flex-1 px-3 md:px-6 pb-4">
                          <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-emerald-500/10">
                                  <Wallet className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Caixa Disponível</p>
                                  <p className={`text-2xl font-bold text-emerald-400 font-mono transition-all duration-200 ${!showBalances ? "blur-md select-none" : ""}`}>
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

                            {cashMovements && cashMovements.length > 0 ? (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Últimas movimentações
                                </p>
                                <div className="rounded-md border border-border/50 overflow-hidden">
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
                                          <td className={`px-3 py-2 text-right text-xs font-mono font-medium ${Number(m.amount) >= 0 ? "text-emerald-400" : "text-red-400"} transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}>
                                            <span>
                                              {m.type === "entrada" ? "+" : "-"}
                                              {formatBRL(Number(m.amount))}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                Nenhuma movimentação registrada.
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      ) : filteredAssets.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                          Nenhum ativo encontrado para "{search}".
                        </p>
                      ) : (
                        <>
                          {/* ── Tabela: thead sticky, tbody scroll ── */}
                          <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-border/30">
                            {/* thead fixo fora do scroll */}
                            <div className="flex-shrink-0 bg-secondary">
                              <table className="w-full text-sm text-left table-fixed">
                                <colgroup>
                                  <col className="w-[28%] sm:w-[25%]" />
                                  <col className="w-[10%] sm:w-[8%]" />
                                  <col className="hidden sm:table-column w-[14%]" />
                                  <col className="w-[14%] sm:w-[12%]" />
                                  <col className="w-[18%] sm:w-[16%]" />
                                  <col className="w-[18%] sm:w-[14%]" />
                                  <col className="w-[12%] sm:w-[11%]" />
                                </colgroup>
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="px-2 md:px-4 py-2.5 font-medium text-xs">Ativo</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs">Qtd</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs hidden sm:table-cell">Custo Médio</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs">Preço</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs">Total</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs">L/P</th>
                                    <th className="px-1 md:px-3 py-2.5 font-medium text-right text-xs text-blue-400">Hoje</th>
                                  </tr>
                                </thead>
                              </table>
                            </div>

                            {/* tbody scrollável */}
                            <ScrollArea className="flex-1 min-h-0">
                              <table className="w-full text-sm text-left table-fixed">
                                <colgroup>
                                  <col className="w-[28%] sm:w-[25%]" />
                                  <col className="w-[10%] sm:w-[8%]" />
                                  <col className="hidden sm:table-column w-[14%]" />
                                  <col className="w-[14%] sm:w-[12%]" />
                                  <col className="w-[18%] sm:w-[16%]" />
                                  <col className="w-[18%] sm:w-[14%]" />
                                  <col className="w-[12%] sm:w-[11%]" />
                                </colgroup>
                                <tbody className="divide-y divide-border/50">
                                  {filteredAssets.map((asset) => {
                                    const daily = getDailyChange(asset.id);
                                    const isUp = (daily?.changePct ?? 0) >= 0;
                                    return (
                                      <tr
                                        key={asset.id}
                                        className="hover:bg-secondary/20 transition-colors"
                                      >
                                        {/* Ativo */}
                                        <td className="px-2 md:px-4 py-2.5 font-medium text-xs md:text-sm">
                                          <span className="sm:hidden font-mono">{asset.id}</span>
                                          <span className="hidden sm:inline">{asset.name}</span>
                                        </td>
                                        {/* Qtd */}
                                        <td className="px-1 md:px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                          {asset.position < 1
                                            ? asset.position.toFixed(4)
                                            : asset.position % 1 === 0
                                            ? asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                                            : asset.position.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                                        </td>
                                        {/* Custo Médio */}
                                        <td className={`px-1 md:px-3 py-2.5 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}>
                                          {formatCurrency(asset.cost, asset.currency)}
                                        </td>
                                        {/* Preço */}
                                        <td className={`px-1 md:px-3 py-2.5 text-right font-mono text-xs transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}>
                                          {formatCurrency(asset.price, asset.currency)}
                                        </td>
                                        {/* Total */}
                                        <td className={`px-1 md:px-3 py-2.5 text-right font-mono font-medium text-xs transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}>
                                          <span className="sm:hidden">{formatBRLCompact(asset.totalValue)}</span>
                                          <span className="hidden sm:inline">{formatBRL(asset.totalValue)}</span>
                                        </td>
                                        {/* L/P */}
                                        <td className="px-1 md:px-3 py-2.5 text-right text-xs">
                                          <div
                                            className={`flex items-center justify-end gap-0.5 font-mono ${
                                              asset.profit >= 0 ? "text-emerald-500" : "text-red-400"
                                            } transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}
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
                                        {/* Hoje */}
                                        <td className="px-1 md:px-3 py-2.5 text-right text-xs">
                                          {daily ? (
                                            <div
                                              className={`flex flex-col items-end gap-0 font-mono transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}
                                            >
                                              <span className={`font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                                                {formatPct(daily.changePct)}
                                              </span>
                                              <span className={`text-[10px] opacity-80 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                                                <span className="sm:hidden">{formatBRLCompact(daily.changeBRL)}</span>
                                                <span className="hidden sm:inline">{formatBRL(daily.changeBRL)}</span>
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-[10px]">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </ScrollArea>
                          </div>

                          {/* ── Rodapé fixo: total diário da classe ── */}
                          <div className="flex-shrink-0 border-t border-border/50 bg-card/80 px-2 md:px-4 py-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {classDailyTotal >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                              )}
                              <span>Variação hoje — {category.name}</span>
                            </div>
                            <div className={`flex items-center gap-2 font-mono transition-all duration-200 ${!showBalances ? "blur-sm select-none" : ""}`}>
                              <span className={`text-sm font-semibold ${classDailyTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {classDailyTotal >= 0 ? "+" : ""}
                                {formatBRL(classDailyTotal)}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                classDailyPct >= 0
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}>
                                {formatPct(classDailyPct)}
                              </span>
                            </div>
                          </div>
                        </>
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
