import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
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
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_USD_BRL_RATE } from "@shared/constants";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function Rentabilidade() {
  const { showBalances } = useBalanceVisibility();
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const usdBrl = usdBrlData?.rate ?? DEFAULT_USD_BRL_RATE;
  const hasDbData = dbAssets && dbAssets.length > 0;

  const { profitByClass, winners, losers } = useMemo(() => {
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
    };
  }, [hasDbData, dbAssets, usdBrl]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-2">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
            <Skeleton className="col-span-4 h-80 rounded-xl" />
            <div className="col-span-3 space-y-4">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-8">
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">
            Análise de Rentabilidade
          </h2>
          <p className="text-muted-foreground mt-1">
            Desempenho histórico e identificação de oportunidades e riscos.
          </p>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-7">
          {/* Profit by Class Chart */}
          <Card className="col-span-1 lg:col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Lucro/Prejuízo por Classe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`h-[220px] md:h-[350px] w-full mt-4 ${!showBalances ? 'blur-sm' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitByClass}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.30 0.01 250)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="oklch(0.55 0 0)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(0.55 0 0)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: "oklch(0.25 0.01 250 / 0.3)" }}
                      contentStyle={{
                        backgroundColor: "oklch(0.20 0.01 250)",
                        borderColor: "oklch(0.30 0.01 250)",
                        borderRadius: "8px",
                        color: "oklch(0.90 0 0)",
                      }}
                      itemStyle={{ color: "oklch(0.90 0 0)" }}
                      labelStyle={{ color: "oklch(0.70 0 0)" }}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
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
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {asset.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asset.class}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className={`text-sm font-medium font-mono text-emerald-500 ${!showBalances ? 'blur-sm' : ''}`}>
                          +{formatCurrency(asset.profit)}
                        </p>
                        <p className="text-xs text-emerald-500/80">
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
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {asset.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asset.class}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className={`text-sm font-medium font-mono text-red-400 ${!showBalances ? 'blur-sm' : ''}`}>
                          {formatCurrency(asset.profit)}
                        </p>
                        <p className="text-xs text-red-400/80">
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
      </div>
    </DashboardLayout>
  );
}
