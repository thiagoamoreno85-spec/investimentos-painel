import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { portfolioData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

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

const CLASS_CURRENCY: Record<string, string> = {
  rv_nacional: "BRL",
  rv_eua: "USD",
  fundos: "BRL",
  cripto: "USD",
  renda_fixa: "BRL",
  uranio: "USD",
  india: "USD",
  caixa: "BRL",
};

interface ClassGroup {
  id: string;
  name: string;
  totalValue: number;
  percentage: number;
  assets: {
    id: string;
    name: string;
    position: number;
    cost: number;
    price: number;
    totalValue: number;
    profit: number;
    profitPercentage: number;
    currency: string;
  }[];
}

export default function Alocacao() {
  const { data: dbAssets, isLoading } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();
  const usdBrl = usdBrlData?.rate ?? 5.7;
  const hasDbData = dbAssets && dbAssets.length > 0;

  const categories: ClassGroup[] = useMemo(() => {
    if (hasDbData) {
      const classMap = new Map<string, ClassGroup>();
      let totalPatrimony = 0;

      for (const asset of dbAssets!) {
        const qty = parseFloat(asset.totalQuantity);
        const avgCost = parseFloat(asset.averageCost);
        const lastPrice = parseFloat(asset.lastPrice);
        const currency = asset.currency || CLASS_CURRENCY[asset.assetClass] || "BRL";

        let valueBRL = qty * lastPrice;
        let costBRL = qty * avgCost;
        if (currency === "USD") {
          valueBRL *= usdBrl;
          costBRL *= usdBrl;
        }
        totalPatrimony += valueBRL;

        const classId = asset.assetClass;
        const classLabel = ASSET_CLASS_LABELS[classId] || classId;

        if (!classMap.has(classId)) {
          classMap.set(classId, {
            id: classId,
            name: classLabel,
            totalValue: 0,
            percentage: 0,
            assets: [],
          });
        }

        const group = classMap.get(classId)!;
        group.totalValue += valueBRL;

        const profit = valueBRL - costBRL;
        const profitPct = costBRL > 0 ? (profit / costBRL) * 100 : 0;

        group.assets.push({
          id: asset.ticker,
          name: asset.name || asset.ticker,
          position: qty,
          cost: avgCost,
          price: lastPrice,
          totalValue: valueBRL,
          profit,
          profitPercentage: profitPct,
          currency,
        });
      }

      // Calcular percentuais
      const result = Array.from(classMap.values())
        .map((g) => ({
          ...g,
          percentage: totalPatrimony > 0 ? (g.totalValue / totalPatrimony) * 100 : 0,
          assets: g.assets.sort((a, b) => b.totalValue - a.totalValue),
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

      return result;
    }

    // Fallback estático
    return portfolioData.map((cat) => ({
      ...cat,
      assets: cat.assets.map((a) => ({
        ...a,
        currency: "BRL",
      })),
    }));
  }, [hasDbData, dbAssets, usdBrl]);

  function formatCurrency(value: number, currency: string = "BRL") {
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Alocação Detalhada
          </h2>
          <p className="text-muted-foreground mt-1">
            Visualize a composição da sua carteira por classe de ativo.
          </p>
        </div>

        {categories.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum ativo cadastrado. Importe a carteira na página Visão
                Geral ou registre transações.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs
            defaultValue={categories[0]?.id || "rv_nacional"}
            className="w-full"
          >
            <TabsList className="w-full justify-start overflow-x-auto bg-card/50 border border-border/50 h-auto p-1 flex-wrap">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className="mt-6"
              >
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle>{category.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.percentage.toFixed(1)}% do patrimônio total
                      </p>
                    </div>
                    <div className="text-2xl font-bold font-mono">
                      {formatBRL(category.totalValue)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-border/50 overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Ativo</th>
                            <th className="px-4 py-3 font-medium text-right">
                              Posição
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              Custo Médio
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              Preço Atual
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              Valor Total
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              Lucro/Prejuízo
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {category.assets.map((asset) => (
                            <tr
                              key={asset.id}
                              className="hover:bg-secondary/20 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium">
                                {asset.name}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {asset.position < 1
                                  ? asset.position.toFixed(6)
                                  : asset.position.toLocaleString("pt-BR", {
                                      maximumFractionDigits: 2,
                                    })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatCurrency(asset.cost, asset.currency)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatCurrency(asset.price, asset.currency)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">
                                {formatBRL(asset.totalValue)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div
                                  className={`flex items-center justify-end gap-1 font-mono ${
                                    asset.profit >= 0
                                      ? "text-emerald-500"
                                      : "text-red-400"
                                  }`}
                                >
                                  {asset.profit >= 0 ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                  )}
                                  {formatBRL(Math.abs(asset.profit))}
                                  <span className="text-xs ml-1 opacity-80">
                                    ({asset.profitPercentage.toFixed(1)}%)
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
