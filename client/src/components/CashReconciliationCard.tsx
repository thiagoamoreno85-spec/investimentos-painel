import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

export default function CashReconciliationCard() {
  const { showBalances } = useBalanceVisibility();
  const { data: reconciliation } = trpc.cash.getCashReconciliation.useQuery();

  if (!reconciliation) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const discrepancyPercent = reconciliation.statementBalance !== 0
    ? Math.abs(reconciliation.discrepancy / reconciliation.statementBalance) * 100
    : 0;

  const isReconciled = reconciliation.discrepancy === 0;
  const statusColor = isReconciled
    ? "text-emerald-500"
    : discrepancyPercent < 1
      ? "text-yellow-500"
      : "text-destructive";

  const statusIcon = isReconciled
    ? <CheckCircle className="h-4 w-4" />
    : discrepancyPercent < 1
      ? <Clock className="h-4 w-4" />
      : <AlertCircle className="h-4 w-4" />;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Reconciliação de Caixa
        </CardTitle>
        <div className={`flex items-center gap-1 ${statusColor}`}>
          {statusIcon}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plataforma:</span>
            <span className={showBalances ? "font-mono font-semibold" : "blur"}>
              {formatCurrency(Number(reconciliation.platformBalance))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Extrato:</span>
            <span className={showBalances ? "font-mono font-semibold" : "blur"}>
              {formatCurrency(Number(reconciliation.statementBalance))}
            </span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Diferença:</span>
            <span className={`font-mono font-semibold ${statusColor}`}>
              {showBalances ? formatCurrency(Math.abs(Number(reconciliation.discrepancy))) : "•••"}
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Status:{" "}
          <span className={statusColor}>
            {isReconciled
              ? "✓ Reconciliado"
              : discrepancyPercent < 1
                ? "⏱ Pequena diferença"
                : "⚠ Diferença significativa"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
