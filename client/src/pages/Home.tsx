import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summaryData, portfolioData } from "@/lib/data";
import { ArrowUpRight, ArrowDownRight, Wallet, PieChart, TrendingUp, DollarSign } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export default function Home() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-primary)",
    "var(--color-secondary)",
    "var(--color-muted)",
  ];

  const pieData = portfolioData.map((item) => ({
    name: item.name,
    value: item.totalValue,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground mt-1">
            Acompanhe o desempenho da sua carteira de investimentos. Atualizado em {summaryData.lastUpdate}.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Patrimônio Total
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight">
                {formatCurrency(summaryData.totalPatrimony)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inclui caixa e dividendos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro Estimado
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-500">
                +{formatCurrency(summaryData.totalProfit)}
              </div>
              <p className="text-xs text-emerald-500/80 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                {summaryData.profitPercentage}% histórico
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Maior Posição
              </CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                RV Nacional
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                58.8% da carteira
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Caixa Disponível
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight">
                {formatCurrency(41925.91)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pronto para novos aportes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Tables Area */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Allocation Chart */}
          <Card className="col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Alocação por Classe</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Assets List */}
          <Card className="col-span-3 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Top 5 Posições</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { name: "VALE3", class: "RV Nacional", value: 117963.44, profit: 38.2 },
                  { name: "SBSP3", class: "RV Nacional", value: 116131.71, profit: 168.8 },
                  { name: "CMIN3", class: "RV Nacional", value: 108150.66, profit: 2.4 },
                  { name: "KINEA GAMA", class: "Fundos", value: 103553.74, profit: -2.0 },
                  { name: "MBRF3", class: "RV Nacional", value: 78980.40, profit: 44.2 },
                ].map((asset, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.class}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium font-mono">{formatCurrency(asset.value)}</p>
                      <p className={`text-xs flex items-center justify-end gap-1 ${asset.profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {asset.profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(asset.profit)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
