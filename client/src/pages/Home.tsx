import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { summaryData, portfolioData } from "@/lib/data";
import {
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  TrendingUp,
  RefreshCw,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import DashboardLayout from "@/components/DashboardLayout";
import CaixaCard from "@/components/CaixaCard";
import PerformanceCard from "@/components/PerformanceCard";
import { PerformanceCards } from "@/components/PerformanceCards";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { CurrencyBreakdownChart } from "@/components/CurrencyBreakdownChart";
import { EventCalendar } from "@/components/EventCalendar";
import { PatrimonyEvolutionChart } from "@/components/PatrimonyEvolutionChart";
import { ConsolidatedNetWorthCard } from "@/components/ConsolidatedNetWorthCard";

import { ASSET_CLASS_LABELS, CLASS_CURRENCY, classColor } from "@/lib/assetClasses";

export default function Home() {
  const utils = trpc.useUtils();
  const { showBalances, toggleShowBalances } = useBalanceVisibility();
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const { data: cashBalanceData } = trpc.cash.getBalance.useQuery();
  const { data: patrimonialSummary } = trpc.patrimonial.getSummary.useQuery();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshPrices = trpc.portfolio.refreshPrices.useMutation({
    onSuccess: (result) => {
      setLastUpdated(new Date());
      toast.success(
        `${result.updated} cotações atualizadas (${result.cached} em cache). USD/BRL: R$ ${result.usdBrl.toFixed(2)}`
      );
      utils.portfolio.getAssets.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const seedPortfolio = trpc.portfolio.seedPortfolio.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Carteira importada! ${result.created} ativos criados, ${result.skipped} já existiam.`
      );
      utils.portfolio.getAssets.invalidate();
    },
    onError: (err) => toast.error(`Erro ao importar: ${err.message}`),
  });

  const usdBrl = usdBrlData?.rate ?? 5.7;
  const cashBalance = Number(cashBalanceData?.balance ?? 0);
  const hasDbData = dbAssets && dbAssets.length > 0;
  // Computar dados a partir do banco ou dados estáticos
  const { totalPatrimony, totalProfit, profitPct, pieData, topAssets, cashValue, largestClass, largestClassPct } =
    useMemo(() => {
      if (hasDbData) {
        // Dados do banco
        const classMap = new Map<string, number>();
        let patrimony = cashBalance; // inclui caixa dinâmico
        let cost = 0;
        const assetValues: {
          ticker: string;
          name: string;
          classLabel: string;
          valueBRL: number;
          profitPct: number;
        }[] = [];
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
          patrimony += valueBRL;
          cost += costBRL;
          const classLabel = ASSET_CLASS_LABELS[asset.assetClass] || asset.assetClass;
          classMap.set(classLabel, (classMap.get(classLabel) || 0) + valueBRL);
          const profitVal = valueBRL - costBRL;
          const profitP = costBRL > 0 ? (profitVal / costBRL) * 100 : 0;
          assetValues.push({
            ticker: asset.ticker,
            name: asset.name || asset.ticker,
            classLabel,
            valueBRL,
            profitPct: profitP,
          });
        }
        // Adicionar caixa dinâmico ao mapa de classes
        if (cashBalance > 0) {
          classMap.set("Caixa", (classMap.get("Caixa") || 0) + cashBalance);
        }

        const profit = patrimony - cost;
        const pPct = cost > 0 ? (profit / cost) * 100 : 0;

        const pie = Array.from(classMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const top = assetValues
          .sort((a, b) => b.valueBRL - a.valueBRL)
          .slice(0, 5);

        const largest = pie[0];

        return {
          totalPatrimony: patrimony,
          totalProfit: profit,
          profitPct: pPct,
          pieData: pie,
          topAssets: top.map((a) => ({
            name: a.ticker,
            class: a.classLabel,
            value: a.valueBRL,
            profit: a.profitPct,
          })),
          cashValue: cashBalance,
          largestClass: largest?.name || "—",
          largestClassPct: patrimony > 0 ? ((largest?.value || 0) / patrimony) * 100 : 0,
        };
      }

      // Fallback: dados estáticos
      const pie = portfolioData.map((item) => ({
        name: item.name,
        value: item.totalValue,
      }));

      return {
        totalPatrimony: summaryData.totalPatrimony,
        totalProfit: summaryData.totalProfit,
        profitPct: summaryData.profitPercentage,
        pieData: pie,
        topAssets: [
          { name: "VALE3", class: "RV Nacional", value: 117963.44, profit: 38.2 },
          { name: "SBSP3", class: "RV Nacional", value: 116131.71, profit: 168.8 },
          { name: "CMIN3", class: "RV Nacional", value: 108150.66, profit: 2.4 },
          { name: "KINEA GAMA", class: "Fundos", value: 103553.74, profit: -2.0 },
          { name: "MBRF3", class: "RV Nacional", value: 78980.40, profit: 44.2 },
        ],
        cashValue: 0,
        largestClass: "RV Nacional",
        largestClassPct: 58.8,
      };
    }, [hasDbData, dbAssets, usdBrl, cashBalance]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Função para importar carteira estática para o banco
  function handleSeedPortfolio() {
    const allAssets: {
      ticker: string;
      name: string;
      assetClass: "rv_nacional" | "rv_eua" | "fundos" | "cripto" | "renda_fixa" | "uranio" | "india" | "caixa";
      currency: "BRL" | "USD";
      quantity: number;
      averageCost: number;
      lastPrice: number;
    }[] = [];

    const classMapping: Record<string, "rv_nacional" | "rv_eua" | "fundos" | "cripto" | "renda_fixa" | "uranio" | "india" | "caixa"> = {
      "rv-nacional": "rv_nacional",
      "rv-eua": "rv_eua",
      fundos: "fundos",
      cripto: "cripto",
      "renda-fixa": "renda_fixa",
      uranio: "uranio",
      india: "india",
      caixa: "caixa",
    };

    for (const cls of portfolioData) {
      const assetClass = classMapping[cls.id] || "rv_nacional";
      const currency = CLASS_CURRENCY[assetClass] as "BRL" | "USD";

      for (const asset of cls.assets) {
        allAssets.push({
          ticker: asset.id,
          name: asset.name,
          assetClass,
          currency,
          quantity: asset.position,
          averageCost: asset.cost,
          lastPrice: asset.price,
        });
      }
    }

    seedPortfolio.mutate({ assets: allAssets });
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {!hasDbData && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
            <span>⚠️</span>
            <span>Exibindo dados de demonstração. Importe sua carteira para ver valores reais.</span>
          </div>
        )}
        {/* ── HERO: Patrimônio Total ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Patrimônio Financeiro Total
              </p>
              {hasDbData && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ao vivo
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className={`text-3xl md:text-5xl font-bold tracking-tight font-mono text-gradient-hero transition-all duration-200 ${!showBalances ? 'blur-md select-none' : ''}`}>
                {isLoading ? "—" : formatCurrency(totalPatrimony)}
              </h2>
              {!isLoading && (
                <span
                  className={`flex items-center gap-1 text-sm font-semibold font-mono transition-all duration-200 ${
                    totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
                  } ${!showBalances ? 'blur-md select-none' : ''}`}
                >
                  {totalProfit >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {totalProfit >= 0 ? "+" : ""}
                  {formatCurrency(totalProfit)} ({Math.abs(profitPct).toFixed(1)}%)
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1.5">
              Inclui caixa e dividendos · capital + proventos
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!hasDbData && !isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedPortfolio}
                disabled={seedPortfolio.isPending}
                className="gap-2"
              >
                {seedPortfolio.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Importar Carteira
              </Button>
            )}
            {/* Botão ocultar/mostrar valores — sempre visível */}
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
            {hasDbData && (
              <div className="flex items-center gap-2">
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
                {lastUpdated && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards — linha 1: Net Worth (largo) + 3 cards */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-5">
          {/* Net Worth: 2 colunas no mobile, 2 colunas no desktop */}
          <div className="col-span-2 lg:col-span-2 row-span-1">
            <ConsolidatedNetWorthCard financialAssets={totalPatrimony} isLoadingFinancial={isLoading} />
          </div>

          {/* Rentabilidade Total */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Rentabilidade Total
              </CardTitle>
              <TrendingUp
                className={`h-4 w-4 ${
                  totalProfit >= 0 ? "text-emerald-500" : "text-red-400"
                }`}
              />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div
                className={`text-base md:text-2xl font-bold font-mono tracking-tighter truncate transition-all duration-200 ${
                  totalProfit >= 0 ? "text-emerald-500" : "text-red-400"
                } ${!showBalances ? 'blur-md select-none' : ''}`}
              >
                {totalProfit >= 0 ? "+" : ""}
                {formatCurrency(totalProfit)}
              </div>
              <p
                className={`text-xs mt-1 flex items-center gap-1 ${
                  totalProfit >= 0
                    ? "text-emerald-500/80"
                    : "text-red-400/80"
                }`}
              >
                {totalProfit >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(profitPct).toFixed(1)}% (capital + proventos)
              </p>
            </CardContent>
          </Card>

          {/* Maior Posição */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Maior Posição
              </CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className="text-base md:text-2xl font-bold tracking-tighter truncate">
                {largestClass}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {largestClassPct.toFixed(1)}% da carteira
              </p>
            </CardContent>
          </Card>

          {/* Rent. Hoje — ocupa 2 colunas no mobile, 1 no desktop */}
          <div className="col-span-2 lg:col-span-1">
            <PerformanceCard />
          </div>
        </div>

        {/* Summary Cards — linha 2: Alavancagem + Rent. Mês + Caixa (mesma altura) */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 sm:grid-cols-3">
          {/* Alavancagem — Ativos Totais (financeiros + imobilizados) vs Passivos */}
          {(() => {
            // Base de ativos = financeiros (carteira) + imobilizados (patrimônio)
            const totalAtivos = totalPatrimony + (patrimonialSummary?.totalAssets ?? 0);
            const totalPassivos = patrimonialSummary?.totalLiabilities ?? 0;
            const ratio = totalPassivos > 0 ? totalAtivos / totalPassivos : null;
            const pctPassivo = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
            const isHighLeverage = pctPassivo > 50;
            return (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 md:pb-2 md:px-6 md:pt-6">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                    Alavancagem
                  </CardTitle>
                  <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500" />
                </CardHeader>
                <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                  <div className="space-y-2 md:space-y-3">
                    {/* Razão Ativos Totais / Passivos */}
                    <div>
                      <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Ativos / Passivos</p>
                      <div className={`text-sm md:text-2xl font-bold font-mono tracking-tighter transition-all duration-200 ${!showBalances ? 'blur-md select-none' : ''}`}>
                        {ratio !== null ? ratio.toFixed(2) : "∞"}x
                      </div>
                    </div>
                    {/* % Passivo sobre Ativos Totais */}
                    <div className="pt-1.5 md:pt-2 border-t border-border/30">
                      <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">% Passivo</p>
                      <div className={`text-xs md:text-lg font-bold font-mono tracking-tighter ${
                        totalAtivos > 0
                          ? isHighLeverage ? "text-amber-500" : "text-emerald-500"
                          : "text-muted-foreground"
                      } transition-all duration-200 ${!showBalances ? 'blur-md select-none' : ''}`}>
                        {pctPassivo.toFixed(1)}%
                      </div>
                      <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {!showBalances ? "••••" : formatCurrency(totalAtivos)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Rent. Mês */}
          <PerformanceCards />

          {/* Caixa Disponível — ocupa 2 colunas no mobile, 1 no sm+ */}
          <div className="col-span-2 sm:col-span-1">
            <CaixaCard />
          </div>
        </div>

        {/* Charts and Tables Area */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-7">
          {/* Allocation Chart */}
          <Card className="col-span-1 lg:col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Alocação por Classe</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              {/* Donut + legenda lado a lado em mobile, empilhado em desktop */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Donut */}
                <div className="h-[180px] sm:h-[220px] w-full sm:w-[220px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="40%"
                        outerRadius="68%"
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={classColor(entry.name)}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "oklch(0.20 0.01 250)",
                          borderColor: "oklch(0.30 0.01 250)",
                          borderRadius: "8px",
                          color: "oklch(0.90 0 0)",
                          fontSize: "12px",
                          padding: "6px 10px",
                        }}
                        itemStyle={{ color: "oklch(0.90 0 0)" }}
                        labelStyle={{ color: "oklch(0.70 0 0)" }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda compacta — 3 colunas em mobile, lista em desktop */}
                <div className="grid grid-cols-3 sm:grid-cols-1 gap-x-2 gap-y-2 flex-1 min-w-0">
                  {pieData.map((entry) => {
                    const total = pieData.reduce((s, e) => s + e.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={entry.name} className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: classColor(entry.name) }}
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate leading-tight">{entry.name}</p>
                          <p className="text-[10px] sm:text-xs font-medium leading-tight">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Assets List */}
          <Card className="col-span-1 lg:col-span-3 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Top 5 Posições</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {topAssets.map((asset, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {asset.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asset.class}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className={`text-sm font-medium font-mono transition-all duration-200 ${!showBalances ? 'blur-sm select-none' : ''}`}>
                        {formatCurrency(asset.value)}
                      </p>
                      <p
                        className={`text-xs flex items-center justify-end gap-1 ${
                          asset.profit >= 0
                            ? "text-emerald-500"
                            : "text-red-400"
                        }`}
                      >
                        {asset.profit >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(asset.profit).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Currency Breakdown Chart */}
        <div className="mt-6">
          <PatrimonyEvolutionChart />
        </div>

        {/* Currency Breakdown Chart */}
        <div className="mt-6">
          <CurrencyBreakdownChart />
        </div>

        {/* Benchmark Chart */}
        <div className="mt-6">
          <BenchmarkChart />
        </div>

        {/* Event Calendar */}
        <div className="mt-6">
          <EventCalendar />
        </div>
      </div>
    </DashboardLayout>
  );
}
