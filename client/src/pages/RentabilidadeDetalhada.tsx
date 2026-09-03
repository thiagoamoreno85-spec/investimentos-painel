import DashboardLayout from "@/components/DashboardLayout";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, CalendarDays, Filter, Landmark, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const CLASS_LABELS: Record<string, string> = {
  rv_nacional: "RV Nacional",
  rv_eua: "RV EUA",
  fundos: "Fundos",
  cripto: "Criptomoedas",
  renda_fixa: "Renda Fixa",
  uranio: "Urânio",
  india: "Índia",
};

const SOURCE_LABELS: Record<string, string> = {
  ledger: "Fechamento",
  reconstructed: "Reconstruído",
  live: "Intradiário",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", weekday: "short" })
    .format(new Date(`${date}T12:00:00-03:00`))
    .replace(".", "");
}

function ReturnText({ value, percent, blur }: { value: number; percent: number; blur: boolean }) {
  const positive = value >= 0;
  return (
    <div className={`flex flex-col items-end ${positive ? "text-emerald-500" : "text-red-400"} ${blur ? "blur-sm" : ""}`}>
      <span className="font-mono text-sm font-semibold">{positive ? "+" : ""}{formatCurrency(value)}</span>
      <span className="font-mono text-xs">{positive ? "+" : ""}{percent.toFixed(2)}%</span>
    </div>
  );
}

export default function RentabilidadeDetalhada() {
  const [, setLocation] = useLocation();
  const { showBalances } = useBalanceVisibility();
  const { data, isLoading } = trpc.portfolio.getMonthlyPerformanceDetails.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMovements, setOnlyMovements] = useState(false);

  const selectedDay = useMemo(() => {
    if (!data?.days.length) return null;
    return data.days.find((day) => day.date === selectedDate) ?? data.days[data.days.length - 1];
  }, [data, selectedDate]);

  const visibleAssets = useMemo(() => {
    if (!selectedDay) return [];
    const query = search.trim().toLowerCase();
    return selectedDay.byAsset
      .filter((asset) => !onlyMovements || Math.abs(asset.changeBRL) >= 0.01)
      .filter((asset) => !query || asset.ticker.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query))
      .sort((a, b) => Math.abs(b.changeBRL) - Math.abs(a.changeBRL));
  }, [selectedDay, search, onlyMovements]);

  const dayMarketPnl = selectedDay?.byAsset.reduce((sum, asset) => sum + asset.marketPnlBRL, 0) ?? 0;
  const dayIncomePnl = selectedDay?.byAsset.reduce((sum, asset) => sum + asset.incomePnlBRL, 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-emerald-500" />
              <h1 className="text-xl font-bold tracking-tight md:text-3xl">Rentabilidade Mensal Detalhada</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Auditoria diária por ativo. Compras, vendas, corretagens e proventos são tratados separadamente do retorno de mercado.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/rentabilidade")} className="gap-2 self-start">
            <ArrowLeft className="h-4 w-4" /> Voltar para Rentabilidade
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
          </div>
        ) : !data || !selectedDay ? (
          <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Ainda não há dados de rentabilidade disponíveis para o mês.</CardContent></Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="bg-card/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resultado do dia</p><ReturnText value={selectedDay.returnValue} percent={selectedDay.returnPct} blur={!showBalances} /></CardContent></Card>
              <Card className="bg-card/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mercado</p><ReturnText value={dayMarketPnl} percent={selectedDay.returnPct} blur={!showBalances} /></CardContent></Card>
              <Card className="bg-card/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Proventos recebidos</p><ReturnText value={dayIncomePnl} percent={0} blur={!showBalances} /></CardContent></Card>
            </div>

            <Card className="bg-card/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Dias do mês</CardTitle></CardHeader>
              <CardContent className="flex gap-2 overflow-x-auto pb-4">
                {data.days.map((day) => {
                  const active = selectedDay.date === day.date;
                  const positive = day.returnValue >= 0;
                  return <button key={day.date} onClick={() => setSelectedDate(day.date)} className={`min-w-[108px] rounded-lg border p-3 text-left transition-colors ${active ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:bg-muted/50"}`}>
                    <p className="text-xs font-medium capitalize text-muted-foreground">{formatDate(day.date)}</p>
                    <p className={`mt-1 font-mono text-sm font-semibold ${positive ? "text-emerald-500" : "text-red-400"} ${!showBalances ? "blur-sm" : ""}`}>{positive ? "+" : ""}{day.returnPct.toFixed(2)}%</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{SOURCE_LABELS[day.source ?? "reconstructed"]}</p>
                  </button>;
                })}
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle className="text-base">Ativos em {formatDate(selectedDay.date)}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{visibleAssets.length} ativos exibidos · {SOURCE_LABELS[selectedDay.source ?? "reconstructed"]}</p></div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ativo" className="w-28 bg-transparent text-xs outline-none" /></label>
                  <Button variant={onlyMovements ? "secondary" : "outline"} size="sm" className="gap-2" onClick={() => setOnlyMovements(!onlyMovements)}><Filter className="h-3.5 w-3.5" />Movimentos</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 md:p-2">
                <Table className="min-w-[850px]">
                  <TableHeader><TableRow><TableHead>Ativo</TableHead><TableHead>Classe</TableHead><TableHead className="text-right">Mercado</TableHead><TableHead className="text-right">Proventos</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">Rent. Dia</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleAssets.map((asset) => {
                      const positive = asset.changeBRL >= 0;
                      return <TableRow key={asset.assetId}>
                        <TableCell><div className="font-medium">{asset.ticker}</div><div className="max-w-[200px] truncate text-xs text-muted-foreground">{asset.name}</div></TableCell>
                        <TableCell><span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{CLASS_LABELS[asset.classKey] ?? asset.classKey}</span></TableCell>
                        <TableCell className={`text-right font-mono text-xs ${asset.marketPnlBRL >= 0 ? "text-emerald-500" : "text-red-400"} ${!showBalances ? "blur-sm" : ""}`}>{asset.marketPnlBRL >= 0 ? "+" : ""}{formatCurrency(asset.marketPnlBRL)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${asset.incomePnlBRL >= 0 ? "text-emerald-500" : "text-red-400"} ${!showBalances ? "blur-sm" : ""}`}>{asset.incomePnlBRL >= 0 ? "+" : ""}{formatCurrency(asset.incomePnlBRL)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm font-semibold ${positive ? "text-emerald-500" : "text-red-400"} ${!showBalances ? "blur-sm" : ""}`}>{positive ? "+" : ""}{formatCurrency(asset.changeBRL)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${positive ? "text-emerald-500" : "text-red-400"}`}>{positive ? <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" />}{positive ? "+" : ""}{asset.changePct.toFixed(2)}%</TableCell>
                      </TableRow>;
                    })}
                    {visibleAssets.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nenhum ativo corresponde aos filtros.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="h-3.5 w-3.5" />Fechamento usa o ledger diário; “Reconstruído” usa preços históricos e movimentos já registrados; “Intradiário” será substituído pelo fechamento automático.</p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
