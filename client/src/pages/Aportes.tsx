import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Calculator, Target, Calendar, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CLASS_CURRENCY } from "@/lib/assetClasses";
import { buildHomePortfolioSummary } from "@shared/homePortfolioSummary";
import { SensitiveContent } from "@/components/SensitiveContent";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { AccessibleChartAlternative } from "@/components/AccessibleChartAlternative";

export default function Aportes() {
  const { showBalances } = useBalanceVisibility();
  const [aporteMensal, setAporteMensal] = useState(10_000);
  const [anos, setAnos] = useState(10);
  const [taxaAnual, setTaxaAnual] = useState(12);
  const assetsQuery = trpc.portfolio.getAssets.useQuery(undefined, { enabled: showBalances });
  const cashBalanceQuery = trpc.cash.getBalance.useQuery(undefined, { enabled: showBalances });
  const usdBrlQuery = trpc.portfolio.getUsdBrl.useQuery();

  const patrimonioAtual = useMemo(() => {
    const assets = assetsQuery.data;
    if (!assets) return null;

    const hasUsdAssets = assets.some(
      (asset) => (asset.currency || CLASS_CURRENCY[asset.assetClass]) === "USD",
    );
    const usdBrl = usdBrlQuery.data?.rate ?? 0;
    if (hasUsdAssets && (!Number.isFinite(usdBrl) || usdBrl <= 0)) return null;

    return buildHomePortfolioSummary(
      assets,
      Number(cashBalanceQuery.data?.balance ?? 0),
      usdBrl,
    ).totalPatrimony;
  }, [assetsQuery.data, cashBalanceQuery.data?.balance, usdBrlQuery.data?.rate]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);

  const projectionData = useMemo(() => {
    if (patrimonioAtual === null) return [];
    const data: { year: string; patrimonio: number }[] = [];
    let currentPatrimony = patrimonioAtual;
    const monthlyRate = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;

    for (let year = 0; year <= anos; year++) {
      data.push({ year: `Ano ${year}`, patrimonio: Math.round(currentPatrimony) });
      for (let month = 1; month <= 12; month++) {
        currentPatrimony = currentPatrimony * (1 + monthlyRate) + aporteMensal;
      }
    }
    return data;
  }, [anos, aporteMensal, patrimonioAtual, taxaAnual]);

  const valorFinal = projectionData.at(-1)?.patrimonio ?? 0;
  const isLoadingBase = assetsQuery.isLoading || cashBalanceQuery.isLoading || usdBrlQuery.isLoading;
  const hasUnavailableBase = !isLoadingBase && patrimonioAtual === null;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight md:text-3xl">Simulador de Aportes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Projete cenários de longo prazo. As estimativas não são recomendação, garantia de retorno ou ordem de investimento.
          </p>
        </div>

        <SensitiveContent
          fallback={
            <Card className="border-dashed border-border bg-card/50">
              <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Simulação financeira ocultada</p>
                  <p className="mt-1 text-sm text-muted-foreground">Mostre os valores para consultar ou editar os parâmetros da projeção.</p>
                </div>
              </CardContent>
            </Card>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
            <Card className="col-span-1 border-border/50 bg-card/50 shadow-sm md:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
                  Parâmetros
                </CardTitle>
                <CardDescription>Ajuste os valores para comparar cenários</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="aporte">Aporte mensal (R$)</Label>
                  <Input id="aporte" type="number" min="0" value={aporteMensal} onChange={(event) => setAporteMensal(Math.max(0, Number(event.target.value) || 0))} className="bg-background/50 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anos">Prazo (anos)</Label>
                  <Input id="anos" type="number" min="0" max="60" value={anos} onChange={(event) => setAnos(Math.min(60, Math.max(0, Number(event.target.value) || 0)))} className="bg-background/50 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxa">Rentabilidade anual esperada (%)</Label>
                  <Input id="taxa" type="number" min="-99" max="100" step="0.1" value={taxaAnual} onChange={(event) => setTaxaAnual(Math.min(100, Math.max(-99, Number(event.target.value) || 0)))} className="bg-background/50 font-mono" />
                </div>
                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Patrimônio atual usado como base</span>
                    {isLoadingBase ? <span className="text-muted-foreground">Carregando…</span> : hasUnavailableBase ? <span className="text-amber-300">Base indisponível</span> : <span className="font-mono font-medium">{formatCurrency(patrimonioAtual ?? 0)}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="col-span-1 space-y-4 md:col-span-8 md:space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-primary"><Target className="h-4 w-4" aria-hidden="true" />Patrimônio projetado</CardTitle></CardHeader>
                  <CardContent><div className="font-mono text-3xl font-bold tracking-tight text-primary">{formatCurrency(valorFinal)}</div><p className="mt-1 text-xs text-muted-foreground">Em {anos} anos, com aportes mensais e a taxa informada acima.</p></CardContent>
                </Card>
                <Card className="border-border/50 bg-card/50 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Calendar className="h-4 w-4" aria-hidden="true" />Renda passiva mensal estimada</CardTitle></CardHeader>
                  <CardContent><div className="font-mono text-3xl font-bold tracking-tight">{formatCurrency(valorFinal * 0.005)}</div><p className="mt-1 text-xs text-muted-foreground">Hipótese ilustrativa de retirada mensal de 0,5%; não é garantia de sustentabilidade.</p></CardContent>
                </Card>
              </div>

              <Card className="border-border/50 bg-card/50 shadow-sm">
                <CardHeader><CardTitle>Evolução projetada do patrimônio</CardTitle></CardHeader>
                <CardContent>
                  {isLoadingBase ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Carregando a base da simulação…</p>
                  ) : hasUnavailableBase ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">A projeção aguarda a confirmação da base de patrimônio e do câmbio.</p>
                  ) : (
                    <>
                      <div className="mt-4 h-[300px] w-full" aria-hidden="true">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={projectionData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                            <defs><linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${(value / 1_000_000).toFixed(1)}M`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", borderRadius: "8px" }} />
                            <Area type="monotone" dataKey="patrimonio" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPatrimonio)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <AccessibleChartAlternative title="Dados da projeção" summary="A tabela expansível apresenta o patrimônio estimado no início de cada ano do cenário selecionado." columns={[{ id: "year", label: "Ano", render: (row) => row.year }, { id: "patrimonio", label: "Patrimônio estimado", render: (row) => formatCurrency(row.patrimonio) }]} rows={projectionData} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </SensitiveContent>
      </div>
    </DashboardLayout>
  );
}
