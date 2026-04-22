import DashboardLayout from "@/components/DashboardLayout";
import { portfolioData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function Alocacao() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Alocação Detalhada</h2>
          <p className="text-muted-foreground mt-1">
            Visualize a composição da sua carteira por classe de ativo.
          </p>
        </div>

        <Tabs defaultValue="rv-nacional" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-card/50 border border-border/50 h-auto p-1">
            {portfolioData.map((category) => (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2"
              >
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {portfolioData.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-6">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.percentage}% do patrimônio total
                    </p>
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {formatCurrency(category.totalValue)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Ativo</th>
                          <th className="px-4 py-3 font-medium text-right">Posição</th>
                          <th className="px-4 py-3 font-medium text-right">Custo Médio</th>
                          <th className="px-4 py-3 font-medium text-right">Preço Atual</th>
                          <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                          <th className="px-4 py-3 font-medium text-right">Lucro/Prejuízo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {category.assets.map((asset) => (
                          <tr key={asset.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{asset.name}</td>
                            <td className="px-4 py-3 text-right font-mono">{asset.position.toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(asset.cost)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(asset.price)}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(asset.totalValue)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className={`flex items-center justify-end gap-1 font-mono ${asset.profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                {asset.profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatCurrency(Math.abs(asset.profit))}
                                <span className="text-xs ml-1 opacity-80">({asset.profitPercentage}%)</span>
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
      </div>
    </DashboardLayout>
  );
}
