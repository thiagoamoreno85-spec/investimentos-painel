import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { portfolioData } from "@/lib/data";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Trophy,
  Layers,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ASSET_CLASS_LABELS, CLASS_CURRENCY, classColor } from "@/lib/assetClasses";
import { BenchmarkChart } from "@/components/BenchmarkChart";

export default function Rentabilidade() {
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const usdBrl = usdBrlData?.rate ?? 5.7;
  const hasDbData = dbAssets && dbAssets.length > 0;

  const { profitByClass, winners, losers, totalProfit, assetCount } = useMemo(() => {
    if (hasDbData) {
      const classProfit = new Map<string, number>();
      const assetList: {
        name: string;
        class: string;
        profitBRL: number;
        profitPct: number;
      }[] = [];

      for (const asset of dbAssets!) {
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

        const profit = valueBRL - costBRL;
        const profitPct = costBRL > 0 ? (profit / costBRL) * 100 : 0;
        const classLabel = ASSET_CLASS_LABELS[asset.assetClass] || asset.assetClass;

        if (asset.assetClass !== "caixa") {
          classProfit.set(classLabel, (classProfit.get(classLabel) || 0) + profit);
          assetList.push({
            name: asset.ticker,
            class: classLabel,
            profitBRL: profit,
            profitPct,
          });
        }
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
      const total = assetList.reduce((sum, a) => sum + a.profitBRL, 0);

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

    // Fallback estático
    const pbc = portfolioData
      .map((category) => {
        const totalProfit = category.assets.reduce((sum, asset) => sum + asset.profit, 0);
        return {
          name: category.name,
          profit: totalProfit,
          isPositive: totalProfit >= 0,
        };
      })
      .filter((item) => item.name !== "Caixa + Dividendos");

    const allAssets = portfolioData.flatMap((c) => c.assets).filter((a) => a.class !== "Caixa");
    const w = [...allAssets].sort((a, b) => b.profit - a.profit).slice(0, 5);
    const l = [...allAssets].sort((a, b) => a.profit - b.profit).slice(0, 5);
    const total = allAssets.reduce((sum, a) => sum + a.profit, 0);

    return {
      profitByClass: pbc,
      winners: w.map((a) => ({
        name: a.name,
        class: a.class,
        profit: a.profit,
        profitPercentage: a.profitPercentage,
      })),
      losers: l.map((a) => ({
        name: a.name,
        class: a.class,
        profit: a.profit,
        profitPercentage: a.profitPercentage,
      })),
      totalProfit: total,
      assetCount: allAssets.length,
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
              }`}>
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
                <p className="text-xs text-emerald-500/80 font-mono">
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
                <p className="text-xs text-red-400/80 font-mono">
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
              <div className="h-[220px] md:h-[350px] w-full mt-4">
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
                        <p className="text-sm font-medium font-mono text-emerald-500">
                          +{formatCurrency(asset.profit)}
                        </p>
                        <p className="text-xs text-emerald-500/80 font-mono">
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
                        <p className="text-sm font-medium font-mono text-red-400">
                          {formatCurrency(asset.profit)}
                        </p>
                        <p className="text-xs text-red-400/80 font-mono">
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
