import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Calculator, Target, Calendar } from "lucide-react";

export default function Aportes() {
  const [aporteMensal, setAporteMensal] = useState(10000);
  const [anos, setAnos] = useState(10);
  const [taxaAnual, setTaxaAnual] = useState(12);
  const patrimonioAtual = 1914184;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Generate projection data
  const generateProjection = () => {
    const data = [];
    let currentPatrimony = patrimonioAtual;
    const monthlyRate = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;

    for (let year = 0; year <= anos; year++) {
      data.push({
        year: `Ano ${year}`,
        patrimonio: Math.round(currentPatrimony),
      });
      
      // Calculate next year
      for (let month = 1; month <= 12; month++) {
        currentPatrimony = currentPatrimony * (1 + monthlyRate) + aporteMensal;
      }
    }
    return data;
  };

  const projectionData = generateProjection();
  const valorFinal = projectionData[projectionData.length - 1].patrimonio;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulador de Aportes</h2>
          <p className="text-muted-foreground mt-1">
            Projete o crescimento do seu patrimônio para a independência financeira dos filhos.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-12">
          {/* Calculator Form */}
          <Card className="md:col-span-4 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Parâmetros
              </CardTitle>
              <CardDescription>Ajuste os valores para simular cenários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="aporte">Aporte Mensal (R$)</Label>
                <Input 
                  id="aporte" 
                  type="number" 
                  value={aporteMensal} 
                  onChange={(e) => setAporteMensal(Number(e.target.value))}
                  className="font-mono bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="anos">Prazo (Anos)</Label>
                <Input 
                  id="anos" 
                  type="number" 
                  value={anos} 
                  onChange={(e) => setAnos(Number(e.target.value))}
                  className="font-mono bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxa">Rentabilidade Anual Esperada (%)</Label>
                <Input 
                  id="taxa" 
                  type="number" 
                  value={taxaAnual} 
                  onChange={(e) => setTaxaAnual(Number(e.target.value))}
                  className="font-mono bg-background/50"
                />
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Patrimônio Atual Base:</span>
                  <span className="font-mono font-medium">{formatCurrency(patrimonioAtual)}</span>
                </div>
                <Button className="w-full mt-4" variant="default">
                  Atualizar Projeção
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Projection Chart & Results */}
          <div className="md:col-span-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-primary/5 border-primary/20 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Patrimônio Projetado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-primary tracking-tight">
                    {formatCurrency(valorFinal)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Em {anos} anos com aportes de {formatCurrency(aporteMensal)}/mês
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Renda Passiva Mensal Estimada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono tracking-tight">
                    {formatCurrency(valorFinal * 0.005)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Considerando retirada segura de 0,5% ao mês
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Evolução do Patrimônio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis 
                        dataKey="year" 
                        stroke="var(--color-muted-foreground)" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="var(--color-muted-foreground)" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="patrimonio" 
                        stroke="var(--color-primary)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorPatrimonio)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
