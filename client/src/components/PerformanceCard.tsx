import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function PerformanceCard() {
  const [expanded, setExpanded] = useState(false);
  const { showBalances } = useBalanceVisibility();
  const { data, isLoading, isError } = trpc.portfolio.getDailyPerformance.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Rent. Hoje</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Rent. Hoje</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-bold text-muted-foreground">—</div>
          <p className="text-xs text-muted-foreground mt-1">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = data.totalPct >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-emerald-500" : "text-red-400";

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Rent. Hoje
        </CardTitle>
        <TrendIcon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-sm sm:text-base md:text-xl font-bold font-mono leading-tight ${color} ${
          !showBalances ? "blur-sm" : ""
        }`}>
          {isPositive ? "+" : ""}{data.totalPct.toFixed(2)}%
        </div>
        <p className={`text-xs mt-1 ${color} ${
          !showBalances ? "blur-sm" : ""
        }`}>
          {isPositive ? "+" : ""}{formatCurrency(data.totalBRL)}
        </p>

        {/* Toggle para mostrar/esconder breakdown por classe */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Ocultar classes" : "Ver por classe"}
        </button>

        {expanded && data.byClass.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
            {data.byClass.map((cls) => {
              const clsPositive = cls.changePct >= 0;
              const clsColor = cls.changePct === 0
                ? "text-muted-foreground"
                : clsPositive
                ? "text-emerald-500"
                : "text-red-400";
              return (
                <div key={cls.classKey} className="text-xs">
                  <div className="text-muted-foreground mb-0.5">{cls.className}</div>
                  <div className={`font-mono font-medium ${clsColor} flex items-center gap-1 ${
                    !showBalances ? "blur-sm" : ""
                  }`}>
                    <span>{clsPositive ? "+" : ""}{cls.changePct.toFixed(2)}%</span>
                    <span className="text-[10px] opacity-80">({clsPositive ? "+" : ""}{formatCurrency(cls.changeBRL)})</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
