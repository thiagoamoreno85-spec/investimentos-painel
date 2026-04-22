import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { portfolioData } from "@/lib/data";
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";

export default function Rentabilidade() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate total profit per class
  const profitByClass = portfolioData.map(category => {
    const totalProfit = category.assets.reduce((sum, asset) => sum + asset.profit, 0);
    return {
      name: category.name,
      profit: totalProfit,
      isPositive: totalProfit >= 0
    };
  }).filter(item => item.name !== "Caixa + Dividendos");

  // Get top winners and losers
  const allAssets = portfolioData.flatMap(c => c.assets).filter(a => a.class !== "Caixa");
  const winners = [...allAssets].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const losers = [...allAssets].sort((a, b) => a.profit - b.profit).slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análise de Rentabilidade</h2>
          <p className="text-muted-foreground mt-1">
            Desempenho histórico e identificação de oportunidades e riscos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Profit by Class Chart */}
          <Card className="col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Lucro/Prejuízo por Classe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitByClass} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="var(--color-muted-foreground)" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="var(--color-muted-foreground)" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value / 1000}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'var(--color-secondary)' }}
                      contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {profitByClass.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isPositive ? 'var(--color-emerald-500, #10b981)' : 'var(--color-destructive)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Winners and Losers */}
          <div className="col-span-3 space-y-4">
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
                        <p className="text-sm font-medium leading-none">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.class}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium font-mono text-emerald-500">+{formatCurrency(asset.profit)}</p>
                        <p className="text-xs text-emerald-500/80">+{asset.profitPercentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-destructive/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Atenção (Maiores Prejuízos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {losers.map((asset, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.class}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium font-mono text-destructive">{formatCurrency(asset.profit)}</p>
                        <p className="text-xs text-destructive/80">{asset.profitPercentage}%</p>
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
