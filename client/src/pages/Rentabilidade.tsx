import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Trophy,
  Layers,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ASSET_CLASS_LABELS, CLASS_CURRENCY, classColor } from "@/lib/assetClasses";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { buildHomePortfolioSummary } from "@shared/homePortfolioSummary";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

export default function Rentabilidade() {
  const { showBalances } = useBalanceVisibility();
  const assetsQuery = trpc.portfolio.getAssets.useQuery();
  const usdBrlQuery = trpc.portfolio.getUsdBrl.useQuery();
  const { data: dbAssets } = assetsQuery;
  const { data: usdBrlData } = usdBrlQuery;
  const usdBrl = usdBrlData?.rate ?? 0;
  const hasDbData = dbAssets && dbAssets.length > 0;
  const hasUsdAssets = dbAssets?.some((asset) => (asset.currency || CLASS_CURRENCY[asset.assetClass]) === "USD") ?? false;
  const isLoading = assetsQuery.isLoading || usdBrlQuery.isLoading;
  const hasCriticalDataError = assetsQuery.isError || usdBrlQuery.isError || (hasUsdAssets && !usdBrlData);

  const { profitByClass, winners, losers, totalProfit, assetCount } = useMemo(() => {
    if (hasDbData) {
      const classProfit = new Map<string, number>();
      const assetList: {
        name: string;
        class: string;
        profitBRL: number;
        profitPct: number;
      }[] = [];

      const summary = buildHomePortfolioSummary(dbAssets!, 0, usdBrl);
      for (const asset of summary.assets) {
        const classLabel = ASSET_CLASS_LABELS[asset.assetClass] || asset.assetClass;
        classProfit.set(classLabel, (classProfit.get(classLabel) || 0) + asset.profitBRL);
        assetList.push({
          name: asset.ticker,
          class: classLabel,
          profitBRL: asset.profitBRL,
          profitPct: asset.profitPct,
        });
      }

      const pbc = Array.from(classProfit.entries())
        .map(([name, profit]) => ({
          name,
          profit,
          isPositive: profit >= 0,
        }))
        .sort((a, b) => b.profit - a.profit);

      const w = [...assetList].sort((a, b) => b.profitBRL - a.profitBRL).slice(0, 5);
      const l = [...assetList].sort((a, b) => a.profitBRL - b.profitBRL).slice(0, 5);
      const total = summary.investmentProfit;

      return {
        profitByClass: pbc,
        winners: w.map((a) => ({
          name: a.name,
          class: a.class,
          profit: a.profitBRL,
          profitPercentage: a.profitPct,
        })),
        losers: l.map((a) => ({
          name: a.name,
          class: a.class,
          profit: a.profitBRL,
          profitPercentage: a.profitPct,
        })),
        totalProfit: total,
        assetCount: assetList.length,
      };
    }

    return {
      profitByClass: [],
      winners: [],
      losers: [],
      totalProfit: 0,
      assetCount: 0,
    };
  }, [hasDbData, dbAssets, usdBrl]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  const bestAsset = winners[0];
  const worstAsset = losers[0];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const retryPerformanceQueries = () => {
    void Promise.all([assetsQuery.refetch(), usdBrlQuery.refetch()]);
  };

  if (hasCriticalDataError) {
    return (
      <DashboardLayout>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center">
            <div>
              <p className="font-medium text-amber-300">Não foi possível calcular a rentabilidade agora.</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">Para evitar resultados incompletos, a tela aguarda a confirmação dos ativos e do câmbio.</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={retryPerformanceQueries}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!hasDbData) {
    return (
      <DashboardLayout>
        <Card className="border-dashed border-border bg-card/50">
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-medium">Nenhum ativo financeiro cadastrado</p>
            <p className="max-w-lg text-sm text-muted-foreground">A análise de rentabilidade será exibida quando houver operações ou ativos confirmados. O painel não criará dados demonstrativos.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">
            Análise de Rentabilidade
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Desempenho histórico, benchmarks e identificação de oportunidades e riscos.
          </p>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className={`w-4 h-4 ${totalProfit >= 0 ? "text-emerald-500" : "text-red-400"}`} />
                <p className="text-xs font-medium">Resultado Total</p>
              </div>
              <p className={`mt-1.5 text-base md:text-xl font-bold font-mono tracking-tight truncate ${
                totalProfit >= 0 ? "text-emerald-500" : "text-red-400"
              } ${!showBalances ? "blur-sm select-none" : ""}`}>
                {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-4 h-4 text-emerald-500" />
                <p className="text-xs font-medium">Melhor Ativo</p>
              </div>
              <p className="mt-1.5 text-base md:text-xl font-bold font-mono tracking-tight truncate">
                {bestAsset?.name ?? "—"}
              </p>
              {bestAsset && (
                <p className={`text-xs text-emerald-500/80 font-mono ${!showBalances ? "blur-sm select-none" : ""}`}>
                  +{formatCurrency(bestAsset.profit)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <p className="text-xs font-medium">Pior Ativo</p>
              </div>
              <p className="mt-1.5 text-base md:text-xl font-bold font-mono tracking-tight truncate">
                {worstAsset?.name ?? "—"}
              </p>
              {worstAsset && (
                <p className={`text-xs text-red-400/80 font-mono ${!showBalances ? "blur-sm select-none" : ""}`}>
                  {formatCurrency(worstAsset.profit)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="w-4 h-4 text-primary" />
                <p className="text-xs font-medium">Ativos em Carteira</p>
              </div>
              <p className="mt-1.5 text-base md:text-xl font-bold font-mono tracking-tight">
                {assetCount}
              </p>
              <p className="text-xs text-muted-foreground">
                em {profitByClass.length} classes
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-7">
          {/* Profit by Class Chart */}
          <Card className="col-span-1 lg:col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Lucro/Prejuízo por Classe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`h-[220px] md:h-[350px] w-full mt-4 transition-all duration-200 ${!showBalances ? "blur-md select-none" : ""}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitByClass}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.27 0.012 261)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="oklch(0.55 0.01 255)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(0.55 0.01 255)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: "oklch(0.24 0.014 261 / 0.4)" }}
                      contentStyle={{
                        backgroundColor: "oklch(0.185 0.014 261)",
                        borderColor: "oklch(0.27 0.012 261)",
                        borderRadius: "8px",
                        color: "oklch(0.93 0.006 255)",
                      }}
                      itemStyle={{ color: "oklch(0.93 0.006 255)" }}
                      labelStyle={{ color: "oklch(0.66 0.012 255)" }}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {profitByClass.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isPositive ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Winners and Losers */}
          <div className="col-span-1 lg:col-span-3 space-y-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                  Maiores Lucros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {winners.map((asset, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: classColor(asset.class) }}
                          aria-hidden="true"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium leading-none font-mono truncate">
                            {asset.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {asset.class}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5 flex-shrink-0">
                        <p className={`text-sm font-medium font-mono text-emerald-500 ${!showBalances ? "blur-sm select-none" : ""}`}>
                          +{formatCurrency(asset.profit)}
                        </p>
                        <p className={`text-xs text-emerald-500/80 font-mono ${!showBalances ? "blur-sm select-none" : ""}`}>
                          +{asset.profitPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-red-500/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Atenção (Maiores Prejuízos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {losers.map((asset, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: classColor(asset.class) }}
                          aria-hidden="true"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium leading-none font-mono truncate">
                            {asset.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {asset.class}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5 flex-shrink-0">
                        <p className={`text-sm font-medium font-mono text-red-400 ${!showBalances ? "blur-sm select-none" : ""}`}>
                          {formatCurrency(asset.profit)}
                        </p>
                        <p className={`text-xs text-red-400/80 font-mono ${!showBalances ? "blur-sm select-none" : ""}`}>
                          {asset.profitPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Comparativo com Benchmarks (CDI e Ibovespa) ── */}
        <BenchmarkChart />
      </div>
    </DashboardLayout>
  );
}
