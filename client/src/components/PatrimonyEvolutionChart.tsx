import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { LineChart as LineChartIcon, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCompact = (value: number) =>
  value >= 1_000_000
    ? `R$ ${(value / 1_000_000).toFixed(1)}M`
    : `R$ ${(value / 1000).toFixed(0)}k`;

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export function PatrimonyEvolutionChart() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolio.getSnapshotHistory.useQuery({ days: 365 });

  const capture = trpc.portfolio.captureSnapshot.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Snapshot ${result.updated ? "atualizado" : "capturado"}: ${formatBRL(result.totalValue)}`
      );
      utils.portfolio.getSnapshotHistory.invalidate();
    },
    onError: (err) => toast.error(`Erro ao capturar snapshot: ${err.message}`),
  });

  const history = data?.history ?? [];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-primary" />
            Evolução do Patrimônio
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => capture.mutate()}
            disabled={capture.isPending}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            title="Registrar o valor de hoje no histórico"
          >
            {capture.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            Capturar hoje
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[220px]">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center px-6">
            <p className="text-sm text-muted-foreground mb-1">
              {history.length === 0
                ? "Nenhum snapshot registrado ainda."
                : "Apenas 1 snapshot registrado — o gráfico aparece a partir do 2º dia."}
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              O valor da carteira é registrado automaticamente todo dia útil após o
              fechamento do mercado. Você também pode capturar manualmente agora.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => capture.mutate()}
              disabled={capture.isPending}
            >
              {capture.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Capturar snapshot de hoje
            </Button>
          </div>
        ) : (
          <div className="h-[220px] md:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="patrimonyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.14 250)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="oklch(0.72 0.14 250)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.27 0.012 261)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.55 0.01 255)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                  minTickGap={40}
                />
                <YAxis
                  stroke="oklch(0.55 0.01 255)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompact}
                  domain={["dataMin", "dataMax"]}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number) => [formatBRL(value), "Patrimônio"]}
                  labelFormatter={(label: string) => formatDate(label)}
                  contentStyle={{
                    backgroundColor: "oklch(0.185 0.014 261)",
                    borderColor: "oklch(0.27 0.012 261)",
                    borderRadius: "8px",
                    color: "oklch(0.93 0.006 255)",
                  }}
                  itemStyle={{ color: "oklch(0.93 0.006 255)" }}
                  labelStyle={{ color: "oklch(0.66 0.012 255)" }}
                />
                <Area
                  type="monotone"
                  dataKey="totalValue"
                  stroke="oklch(0.72 0.14 250)"
                  strokeWidth={2}
                  fill="url(#patrimonyFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "oklch(0.185 0.014 261)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
