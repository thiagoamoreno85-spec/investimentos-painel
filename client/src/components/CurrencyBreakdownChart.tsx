import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBalanceVisibility } from '@/contexts/BalanceVisibilityContext';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function CurrencyBreakdownChart() {
  const { data, isLoading } = trpc.portfolio.getCurrencyBreakdown.useQuery();
  const { showBalances } = useBalanceVisibility();

  if (isLoading || !data) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Exposição Cambial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: 'Real (BRL)', value: data.brl.value, percent: data.brl.percent },
    { name: 'Dolarizado (USD)', value: data.usd.value, percent: data.usd.percent },
  ];

  const COLORS = ['#10b981', '#6366f1'];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle>Exposição Cambial</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Divisão do patrimônio entre Real e Dólar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Câmbio: R$ {data.usdBrl.toFixed(2)}/USD
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                paddingAngle={3}
              >
                {chartData.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  borderColor: 'var(--color-border)',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: 'var(--color-foreground)' }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="text-xs text-emerald-400 font-medium">🟢 Real (BRL)</p>
            <p className={`text-base font-bold mt-1 ${!showBalances ? 'blur-sm' : ''}`}>{formatCurrency(data.brl.value)}</p>
            <p className="text-xs text-muted-foreground">{data.brl.percent.toFixed(1)}% do patrimônio</p>
            <p className="text-xs text-muted-foreground mt-1">{data.brl.classes.join(' · ')}</p>
          </div>
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3">
            <p className="text-xs text-indigo-400 font-medium">🔵 Dolarizado (USD)</p>
            <p className={`text-base font-bold mt-1 ${!showBalances ? 'blur-sm' : ''}`}>{formatCurrency(data.usd.value)}</p>
            <p className="text-xs text-muted-foreground">{data.usd.percent.toFixed(1)}% do patrimônio</p>
            <p className="text-xs text-muted-foreground mt-1">{data.usd.classes.join(' · ')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
