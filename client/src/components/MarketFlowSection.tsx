import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CalendarClock, Landmark, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessibleChartAlternative, type AccessibleChartColumn } from "@/components/AccessibleChartAlternative";
import { aggregateMarketFlows, MARKET_FLOW_PERIODS, summarizeLatestMarketFlowPeriod, type AggregatedMarketFlowPoint, type MarketFlowPeriod } from "@shared/marketFlowPeriod";

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}` : value;
}

function formatSignedFlow(value: number | null, formatter: (value: number) => string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : "−"}${formatter(Math.abs(value))}`;
}

function describeFlow(value: number | null, formatter: (value: number) => string, currencyName: string) {
  if (value === null || !Number.isFinite(value)) return `sem dado disponível em ${currencyName}`;
  const direction = value > 0 ? "entrada" : value < 0 ? "retirada" : "sem entrada ou retirada";
  return `${direction} (${formatSignedFlow(value, formatter)}; ${currencyName})`;
}

const b3TableColumns: AccessibleChartColumn<AggregatedMarketFlowPoint>[] = [
  { id: "period", label: "Período", render: (row) => row.label },
  { id: "foreign", label: "Estrangeiro (BRL)", render: (row) => formatSignedFlow(row.b3Foreign, brlCompact.format) },
  { id: "domestic", label: "Nacional (BRL)", render: (row) => formatSignedFlow(row.b3Domestic, brlCompact.format) },
  { id: "sessions", label: "Pregões divulgados", render: (row) => row.b3Sessions },
];

const ewzTableColumns: AccessibleChartColumn<AggregatedMarketFlowPoint>[] = [
  { id: "period", label: "Período", render: (row) => row.label },
  { id: "proxy", label: "Proxy de criação/resgate (USD)", render: (row) => formatSignedFlow(row.ewzProxy, usdCompact.format) },
  { id: "observations", label: "Observações", render: (row) => row.ewzObservations },
];

function FlowValue({ value, formatter }: { value: number | null; formatter: (value: number) => string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={`font-mono font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? "+" : ""}{formatter(value)}
    </span>
  );
}

export function MarketFlowSection() {
  const flowQuery = trpc.marketFlow.dashboard.useQuery(undefined, { refetchInterval: 15 * 60_000, retry: 1 });
  const [period, setPeriod] = useState<MarketFlowPeriod>("daily");
  const refresh = trpc.marketFlow.refresh.useMutation({
    onSuccess: () => void flowQuery.refetch(),
  });

  const chartRows = useMemo(
    () => aggregateMarketFlows(flowQuery.data?.history ?? [], period),
    [flowQuery.data?.history, period],
  );
  const b3ChartRows = chartRows.filter((row) => row.b3Sessions > 0);
  const ewzRows = chartRows.filter((row) => row.ewzProxy !== null);
  const periodLabel = MARKET_FLOW_PERIODS.find((item) => item.value === period)?.label ?? "Diário";
  const periodSummary = useMemo(() => summarizeLatestMarketFlowPeriod(chartRows), [chartRows]);

  const latestB3 = periodSummary.b3;
  const latestEwz = periodSummary.ewz;
  const foreignFlow = latestB3?.b3Foreign ?? null;
  const domesticFlow = latestB3?.b3Domestic ?? null;
  const ewzProxy = latestEwz?.ewzProxy ?? null;
  const b3TickInterval = Math.max(0, Math.floor(b3ChartRows.length / 7) - 1);
  const ewzTickInterval = Math.max(0, Math.floor(ewzRows.length / 7) - 1);
  const b3ChartContainerRef = useRef<HTMLDivElement>(null);
  const ewzChartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observers = [b3ChartContainerRef.current, ewzChartContainerRef.current]
      .filter((container): container is HTMLDivElement => container !== null)
      .map((container) => {
        const hideChartSvg = () => {
          container.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
        };
        const observer = new MutationObserver(hideChartSvg);

        hideChartSvg();
        observer.observe(container, { childList: true, subtree: true });
        return observer;
      });

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return (
    <Card id="fluxos-b3-ewz" className="bg-card/50 border-border/50 shadow-sm">
      <CardHeader className="px-3 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-cyan-400" />
              Fluxos B3 & EWZ
            </CardTitle>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Dados disponíveis desde 01/07/2026: B3 por perfil de investidor e indicador offshore do EWZ.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">Consolidar por período</p>
          <div className="-mx-1 flex max-w-full snap-x gap-1 overflow-x-auto rounded-lg border border-border/60 bg-secondary/20 p-1 sm:mx-0" role="group" aria-label="Periodicidade dos fluxos">
            {MARKET_FLOW_PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`min-h-9 shrink-0 snap-start rounded-md px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.97] ${
                  period === item.value
                    ? "bg-cyan-500/20 text-cyan-100 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-3 pb-4 sm:px-6 sm:pb-6">
        {flowQuery.isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : flowQuery.isError ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            Não foi possível carregar os fluxos agora. Use “Atualizar” para tentar novamente.
          </div>
        ) : chartRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-5 text-center">
            <p className="font-medium">Ainda não há coleta de fluxos.</p>
            <p className="mt-1 text-sm text-muted-foreground">Clique em “Atualizar” para registrar a primeira leitura da B3 e do EWZ.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3">
                <p className="text-xs text-muted-foreground">Estrangeiro B3 · {periodLabel.toLowerCase()}</p>
                <p className="mt-1 text-sm"><FlowValue value={foreignFlow} formatter={brlCompact.format} /></p>
                <p className="mt-1 text-xs text-muted-foreground">{latestB3?.b3Sessions ?? 0} {latestB3?.b3Sessions === 1 ? "pregão divulgado" : "pregões divulgados"}</p>
              </div>
              <div className="rounded-lg border border-slate-400/20 bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Nacional B3 · {periodLabel.toLowerCase()}</p>
                <p className="mt-1 text-sm"><FlowValue value={domesticFlow} formatter={brlCompact.format} /></p>
                <p className="mt-1 text-xs text-muted-foreground">Contrapartida agregada do período</p>
              </div>
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                <p className="text-xs text-muted-foreground">EWZ · criação/resgate {periodLabel.toLowerCase()}</p>
                <p className="mt-1 text-sm"><FlowValue value={ewzProxy} formatter={usdCompact.format} /></p>
                <p className="mt-1 text-xs text-muted-foreground">{latestEwz?.ewzObservations ?? 0} observação(ões) · Δ cotas × NAV/preço</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Último bloco B3</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-mono font-semibold"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />{latestB3?.label ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">EWZ: {latestEwz?.label ?? "sem dados"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-2 flex items-start gap-1.5 text-sm font-medium leading-snug"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" /> B3 — fluxo líquido {periodLabel.toLowerCase()}</p>
                <p className="mb-1 text-xs text-muted-foreground sm:hidden">Deslize o gráfico para ver toda a série e os rótulos.</p>
                <div ref={b3ChartContainerRef} className="overflow-x-auto rounded-lg border border-border/40 bg-black/10 pb-1" aria-hidden="true">
                  <div className="h-52 min-w-[520px] sm:h-56 sm:min-w-[640px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={b3ChartRows} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} accessibilityLayer={false} aria-hidden="true">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.27 0.012 261)" />
                      <XAxis dataKey="label" interval={b3TickInterval} tickLine={false} axisLine={false} fontSize={11} stroke="oklch(0.6 0.01 255)" />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={52} tickFormatter={(value) => `${(value / 1e9).toFixed(1)} bi`} stroke="oklch(0.6 0.01 255)" />
                      <Tooltip
                        formatter={(value: number, name: string) => [brlCompact.format(value), name === "b3Foreign" ? "Estrangeiro" : "Nacional"]}
                        contentStyle={{ backgroundColor: "oklch(0.185 0.014 261)", borderColor: "oklch(0.27 0.012 261)", borderRadius: 8 }}
                      />
                      <Legend formatter={(value) => value === "b3Foreign" ? "Estrangeiro" : "Nacional"} />
                      <Bar dataKey="b3Foreign" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="b3Domestic" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <AccessibleChartAlternative
                  title="Alternativa textual — fluxo líquido B3"
                  summary={latestB3
                    ? `No último bloco (${latestB3.label}), o fluxo estrangeiro indica ${describeFlow(latestB3.b3Foreign, brlCompact.format, "reais brasileiros (BRL)")}; o fluxo nacional indica ${describeFlow(latestB3.b3Domestic, brlCompact.format, "reais brasileiros (BRL)")}.`
                    : "Não há fluxo B3 divulgado para o período selecionado. Valores desta série são expressos em reais brasileiros (BRL)."}
                  columns={b3TableColumns}
                  rows={b3ChartRows}
                />
              </div>

              <div className="min-w-0">
                <p className="mb-2 flex items-start gap-1.5 text-sm font-medium leading-snug"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" /> EWZ — proxy {periodLabel.toLowerCase()} de criação/resgate</p>
                <p className="mb-1 text-xs text-muted-foreground sm:hidden">Deslize o gráfico para ver toda a série e os rótulos.</p>
                <div ref={ewzChartContainerRef} className="h-52 overflow-x-auto rounded-lg border border-border/40 bg-black/10 pb-1 sm:h-56" aria-hidden="true">
                  {ewzRows.length >= 2 ? (
                    <div className="h-full min-w-[520px] sm:min-w-[640px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ewzRows} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} accessibilityLayer={false} aria-hidden="true">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.27 0.012 261)" />
                          <XAxis dataKey="label" interval={ewzTickInterval} tickLine={false} axisLine={false} fontSize={11} stroke="oklch(0.6 0.01 255)" />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} width={52} tickFormatter={(value) => `$${(value / 1e6).toFixed(0)}m`} stroke="oklch(0.6 0.01 255)" />
                          <Tooltip formatter={(value: number) => [usdCompact.format(value), "Proxy EWZ"]} contentStyle={{ backgroundColor: "oklch(0.185 0.014 261)", borderColor: "oklch(0.27 0.012 261)", borderRadius: 8 }} />
                          <Line type="monotone" dataKey="ewzProxy" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 text-center">
                      <TrendingUp className="h-5 w-5 text-violet-400" />
                      <p className="mt-2 text-sm font-medium">Série EWZ em formação</p>
                      <p className="mt-1 text-xs text-muted-foreground">A segunda coleta permitirá calcular a variação de cotas e o proxy offshore.</p>
                    </div>
                  )}
                </div>
                <AccessibleChartAlternative
                  title="Alternativa textual — proxy EWZ de criação/resgate"
                  summary={latestEwz
                    ? `Na última observação consolidada (${latestEwz.label}), o proxy EWZ indica ${describeFlow(latestEwz.ewzProxy, usdCompact.format, "dólares dos Estados Unidos (USD)")}.`
                    : "Não há observação EWZ para o período selecionado. Valores desta série são expressos em dólares dos Estados Unidos (USD)."}
                  columns={ewzTableColumns}
                  rows={ewzRows}
                />
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs leading-relaxed text-muted-foreground">
              <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p><strong className="text-foreground">Metodologia:</strong> os gráficos somam os fluxos no período selecionado; positivo representa aporte/criação e negativo retirada/resgate. B3 é saldo diário divulgado por perfil de investidor, sujeito à defasagem. EWZ é proxy independente (variação de cotas em circulação × NAV/preço), em USD; não deve ser somado ao fluxo da B3.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
