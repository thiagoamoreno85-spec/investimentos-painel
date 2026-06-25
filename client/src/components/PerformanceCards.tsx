import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Camera,
  ChevronDown,
  ChevronUp,
  Minus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function ReturnIndicator({ value, percent }: { value: number; percent: number }) {
  const isPositive = value >= 0;
  const isZero = Math.abs(percent) < 0.01;

  if (isZero) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">0,0%</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${isPositive ? "text-emerald-500" : "text-red-400"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span className="text-xs">
        {isPositive ? "+" : ""}{percent.toFixed(2)}% ({isPositive ? "+" : ""}{formatCurrency(value)})
      </span>
    </div>
  );
}

// Suppress unused warning — ReturnIndicator is exported for potential reuse
void ReturnIndicator;

function ClassBreakdown({
  data,
  expanded,
  onToggle,
}: {
  data: Record<string, { valueDiff: number; percentDiff: number }> | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Ocultar classes" : "Ver por classe"}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
          {Object.entries(data)
            .sort((a, b) => Math.abs(b[1].valueDiff) - Math.abs(a[1].valueDiff))
            .map(([cls, ret]) => (
              <div key={cls} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {ASSET_CLASS_LABELS[cls] || cls}
                </span>
                <span className={ret.valueDiff >= 0 ? "text-emerald-500" : "text-red-400"}>
                  {ret.valueDiff >= 0 ? "+" : ""}{ret.percentDiff.toFixed(2)}%
                  <span className="text-muted-foreground ml-1">
                    ({ret.valueDiff >= 0 ? "+" : ""}{formatCurrency(ret.valueDiff)})
                  </span>
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * PerformanceCards — renderiza APENAS o card de Rentabilidade Mensal.
 * O card de Rentabilidade Diária é renderizado separadamente pelo PerformanceCard (singular).
 */
export function PerformanceCards() {
  const { data: performance, isLoading } = trpc.portfolio.getPerformance.useQuery();
  const utils = trpc.useUtils();
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);

  const captureSnapshotMutation = trpc.portfolio.captureSnapshot.useMutation({
    onSuccess: () => {
      toast.success("Snapshot capturado com sucesso!");
      utils.portfolio.getPerformance.invalidate();
    },
    onError: (err) => toast.error(`Erro ao capturar snapshot: ${err.message}`),
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!performance) return null;

  // Se não tem snapshots, mostrar card de ativação (ocupa 1 coluna)
  if (!performance.hasSnapshots) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-dashed border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
          <Camera className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">Rent. Mês</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture o primeiro snapshot para acompanhar a evolução mensal.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => captureSnapshotMutation.mutate()}
            disabled={captureSnapshotMutation.isPending}
            className="gap-1 text-xs h-7"
          >
            <Camera className="h-3 w-3" />
            Capturar Snapshot
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    /* Rentabilidade MENSAL — único card renderizado aqui */
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
        <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
          Rent. Mês
        </CardTitle>
        <Calendar
          className={`h-4 w-4 ${
            (performance.monthly.total?.valueDiff ?? 0) >= 0
              ? "text-emerald-500"
              : "text-red-400"
          }`}
        />
      </CardHeader>
      <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
        {performance.monthly.total ? (
          <>
            <div
              className={`text-sm sm:text-base md:text-xl font-bold font-mono leading-tight ${
                performance.monthly.total.valueDiff >= 0 ? "text-emerald-500" : "text-red-400"
              }`}
            >
              {performance.monthly.total.valueDiff >= 0 ? "+" : ""}
              {performance.monthly.total.percentDiff.toFixed(2)}%
            </div>
            <p className={`text-xs mt-0.5 ${
              performance.monthly.total.valueDiff >= 0 ? "text-emerald-500/70" : "text-red-400/70"
            }`}>
              {performance.monthly.total.valueDiff >= 0 ? "+" : ""}
              {formatCurrency(performance.monthly.total.valueDiff)}
            </p>
            <ClassBreakdown
              data={performance.monthly.byClass}
              expanded={monthlyExpanded}
              onToggle={() => setMonthlyExpanded(!monthlyExpanded)}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem snapshot do mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
