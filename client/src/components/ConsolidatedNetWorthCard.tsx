import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

interface ConsolidatedNetWorthCardProps {
  financialAssets: number; // Total de ativos financeiros (portfolio)
  isLoadingFinancial?: boolean;
}

export function ConsolidatedNetWorthCard({
  financialAssets,
  isLoadingFinancial = false,
}: ConsolidatedNetWorthCardProps) {
  const { showBalances } = useBalanceVisibility();
  const { data: patrimonialData, isLoading: isLoadingPatrimonial } =
    trpc.patrimonial.getConsolidatedNetWorth.useQuery();

  const isLoading = isLoadingFinancial || isLoadingPatrimonial;

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth Consolidado
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!patrimonialData) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth Consolidado
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  // Calcular Net Worth total: Ativos Financeiros + Patrimônio Líquido
  const totalNetWorth = financialAssets + patrimonialData.patrimonialNetWorth;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const blurClass = !showBalances ? "blur-sm select-none" : "";

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Net Worth Consolidado
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-emerald-500" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total Net Worth */}
        <div>
          <div className={`text-2xl font-bold font-mono tracking-tight text-emerald-500 ${blurClass}`}>
            {formatCurrency(totalNetWorth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ativos Financeiros + Patrimônio Líquido
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
          {/* Ativos Financeiros */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ativos Financeiros</p>
            <p className={`text-sm font-mono font-semibold text-cyan-400 ${blurClass}`}>
              {formatCurrency(financialAssets)}
            </p>
          </div>

          {/* Patrimônio Líquido */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Patrimônio Líquido</p>
            <p
              className={`text-sm font-mono font-semibold ${
                patrimonialData.patrimonialNetWorth >= 0
                  ? "text-emerald-400"
                  : "text-destructive"
              } ${blurClass}`}
            >
              {formatCurrency(patrimonialData.patrimonialNetWorth)}
            </p>
          </div>

          {/* Ativos Imobilizados */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ativos Imobilizados</p>
            <p className={`text-xs font-mono text-muted-foreground ${blurClass}`}>
              {formatCurrency(patrimonialData.patrimonialAssets)}
            </p>
          </div>

          {/* Passivos */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Passivos</p>
            <p className={`text-xs font-mono text-destructive/70 ${blurClass}`}>
              -{formatCurrency(patrimonialData.patrimonialLiabilities)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
