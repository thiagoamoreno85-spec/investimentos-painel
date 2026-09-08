import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BenchmarkChart() {
  const { data: returnHistory, isLoading: returnLoading, isError: returnError, refetch: refetchReturn } = trpc.portfolio.getReturnHistory.useQuery();
  const { data: benchmarks, isLoading: benchmarkLoading, isError: benchmarkError, refetch: refetchBenchmarks } = trpc.market.getBenchmarkHistory.useQuery(
    { fromDate: returnHistory?.fromDate ?? '' },
    { enabled: !!returnHistory?.fromDate }
  );

  const isLoading = returnLoading || benchmarkLoading;

  if (returnError) {
    return (
      <Card className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-1">Rentabilidade vs Benchmarks</h3>
        <p className="text-sm text-muted-foreground">Não foi possível carregar a série da carteira agora.</p>
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => void refetchReturn()}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Button>
      </Card>
    );
  }

  // Mesclar as 3 séries por data
  const merged = returnHistory?.history.map(point => {
    const ibov = benchmarks?.ibov.find((b: any) => b.date === point.date);
    const cdi = benchmarks?.cdi.find((b: any) => b.date === point.date);
    return {
      date: point.date,
      Carteira: parseFloat(point.value.toFixed(2)),
      Ibovespa: ibov ? parseFloat(ibov.value.toFixed(2)) : null,
      CDI: cdi ? parseFloat(cdi.value.toFixed(2)) : null,
    };
  }) ?? [];

  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (merged.length === 0) {
    return (
      <Card className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-1">Rentabilidade vs Benchmarks</h3>
        <p className="text-sm text-muted-foreground">Nenhum dado disponível. Importe suas transações para ver o comparativo.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold mb-1">Rentabilidade vs Benchmarks</h3>
      <p className="text-sm text-muted-foreground mb-4">Retorno acumulado desde a primeira transação</p>
      {benchmarkError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <span>Os benchmarks estão indisponíveis; a série da carteira permanece visível.</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => void refetchBenchmarks()}>
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={merged}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => v !== null ? `${v.toFixed(2)}%` : 'N/A'} />
          <Legend />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="Carteira" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Ibovespa" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="CDI" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
