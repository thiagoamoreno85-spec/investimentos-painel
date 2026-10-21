import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Minus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { useLocation } from "wouter";

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
  showBalances = true,
}: {
  data: Record<string, { valueDiff: number; percentDiff: number }> | null;
  expanded: boolean;
  onToggle: () => void;
  showBalances?: boolean;
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
                <span className={`${ret.valueDiff >= 0 ? "text-emerald-500" : "text-red-400"} ${
                  !showBalances ? "blur-sm" : ""
                }`}>
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
  const [, setLocation] = useLocation();
  const { showBalances } = useBalanceVisibility();
  const { data: performance, isLoading } = trpc.portfolio.getPerformance.useQuery(
    undefined,
    {
      // Atualiza automaticamente a cada 60 segundos para refletir variações do dia
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
    }
  );
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);

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
  const missingClosedDates = performance.monthly.missingClosedDates ?? [];
  const missingDatesPreview = missingClosedDates.slice(0, 3).join(", ");
  const monthlyContributions = performance.monthly.externalContributionsBRL ?? 0;
  const monthlyWithdrawals = performance.monthly.externalWithdrawalsBRL ?? 0;

  // Se não tem snapshots, mostrar card de ativação (ocupa 1 coluna)
  if (!performance.hasSnapshots) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-dashed border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">Retorno mensal oficial indisponível</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aguardando o primeiro fechamento automático válido. Capturas manuais são intradiárias e não entram no retorno oficial.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    /* Retorno mensal fechado, ajustado por operações */
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
        <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
          Retorno mês
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir detalhamento diário da rentabilidade mensal"
          title="Ver detalhamento diário por ativo"
          onClick={() => setLocation("/rentabilidade/detalhes")}
          className="h-7 w-7"
        >
          <Calendar className={`h-4 w-4 ${(performance.monthly.total?.valueDiff ?? 0) >= 0 ? "text-emerald-500" : "text-red-400"}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
        {performance.monthly.total ? (
          <>
            <div
              className={`text-sm sm:text-base md:text-xl font-bold font-mono leading-tight ${
                performance.monthly.total.valueDiff >= 0 ? "text-emerald-500" : "text-red-400"
              } ${
                !showBalances ? "blur-sm" : ""
              }`}
            >
              {performance.monthly.total.valueDiff >= 0 ? "+" : ""}
              {performance.monthly.total.percentDiff.toFixed(2)}%
            </div>
            <p className={`text-xs mt-0.5 ${
              performance.monthly.total.valueDiff >= 0 ? "text-emerald-500/70" : "text-red-400/70"
            } ${
              !showBalances ? "blur-sm" : ""
            }`}>
              {performance.monthly.total.valueDiff >= 0 ? "+" : ""}
              {formatCurrency(performance.monthly.total.valueDiff)}
            </p>
            {performance.monthly.chainedReturn !== null && (
              <p className="text-xs text-muted-foreground/50 mt-1" title="Retorno da carteira investida, encadeado por dia e ajustado por compras, vendas, corretagens e proventos. O caixa conciliado não é tratado como retorno de mercado.">
                {performance.monthly.isPartial ? "Parcial desde " : "Ajustado por fluxos · "}
                {performance.monthly.isPartial
                  ? performance.monthly.baseDate
                  : `${performance.monthly.snapshotCount ?? 0} fechamentos`}
                {performance.monthly.lastClosedDate ? ` · até ${performance.monthly.lastClosedDate}` : ""}
              </p>
            )}
            <div className={`mt-2 rounded-md border border-sky-500/25 bg-sky-500/8 px-2 py-1.5 text-[11px] leading-snug text-sky-100 ${
              !showBalances ? "blur-sm" : ""
            }`}>
              <p className="font-medium">Fluxos externos — fora do retorno de mercado</p>
              <p className="text-sky-100/75">
                Aportes: {formatCurrency(monthlyContributions)} · Retiradas: {formatCurrency(monthlyWithdrawals)}
                {` · Líquido: ${monthlyContributions - monthlyWithdrawals >= 0 ? "+" : ""}${formatCurrency(monthlyContributions - monthlyWithdrawals)}`}
              </p>
            </div>
            {performance.monthly.hasClosedGaps && (
              <div
                role="status"
                className="mt-2 flex gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  <span className="font-medium">Cobertura parcial: </span>
                  {missingClosedDates.length} dia{missingClosedDates.length === 1 ? " útil sem" : "s úteis sem"} fechamento persistido
                  {missingDatesPreview ? ` (${missingDatesPreview}${missingClosedDates.length > 3 ? "…" : ""})` : ""}. O retorno permanece auditável no intervalo coberto.
                </p>
              </div>
            )}
            <ClassBreakdown
              data={performance.monthly.byClass}
              expanded={monthlyExpanded}
              onToggle={() => setMonthlyExpanded(!monthlyExpanded)}
              showBalances={showBalances}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem retorno diário disponível para o mês
          </p>
        )}
      </CardContent>
    </Card>
  );
}
