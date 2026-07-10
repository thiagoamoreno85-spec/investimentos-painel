import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Proventos() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedType, setSelectedType] = useState<string>("all");

  const uploadMutation = trpc.cash.uploadStatement.useMutation();
  const { data: incomes, isLoading: incomesLoading, refetch } = trpc.cash.listIncomes.useQuery({
    type: selectedType === "all" ? undefined : (selectedType as any),
  });
  const { data: statements } = trpc.cash.listStatements.useQuery();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const buffer = await selectedFile.arrayBuffer();
    uploadMutation.mutate(
      {
        file: Buffer.from(buffer),
        fileName: selectedFile.name,
        statementMonth,
      },
      {
        onSuccess: () => {
          setSelectedFile(null);
          refetch();
        },
      }
    );
  };

  const totalIncomes = incomes?.reduce((sum, income) => sum + Number(income.amount), 0) || 0;

  const incomesByType = incomes?.reduce(
    (acc, income) => {
      if (!acc[income.type]) acc[income.type] = 0;
      acc[income.type] += Number(income.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Proventos</h1>
        <p className="text-muted-foreground mt-1">
          Controle de dividendos, JCP, aluguéis e outras receitas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totalIncomes)}</div>
            <p className="text-xs text-muted-foreground mt-1">{incomes?.length || 0} lançamentos</p>
          </CardContent>
        </Card>

        {incomesByType && (
          <>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Dividendos</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCurrency(incomesByType.dividendo || 0)}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">JCP + Outros</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency((incomesByType.jcp || 0) + (incomesByType.rendimento || 0) + (incomesByType.aluguel || 0))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Upload Section */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Extrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Mês do Extrato</label>
              <Input
                type="month"
                value={statementMonth}
                onChange={(e) => setStatementMonth(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo (XLSX)</label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full"
              >
                {uploadMutation.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>

          {uploadMutation.isError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {uploadMutation.error?.message || "Erro ao enviar extrato"}
            </div>
          )}

          {uploadMutation.isSuccess && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              ✓ Extrato processado com sucesso!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statements History */}
      {statements && statements.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Histórico de Extratos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Saldo Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell>{stmt.statementMonth}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{stmt.fileName}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          stmt.status === "processed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : stmt.status === "error"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-yellow-500/10 text-yellow-600"
                        }`}
                      >
                        {stmt.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(stmt.endBalance))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Incomes Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Receitas Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Tabs */}
          <Tabs value={selectedType} onValueChange={setSelectedType} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="dividendo">Dividendos</TabsTrigger>
              <TabsTrigger value="jcp">JCP</TabsTrigger>
              <TabsTrigger value="rendimento">Rendimentos</TabsTrigger>
              <TabsTrigger value="aluguel">Aluguéis</TabsTrigger>
            </TabsList>
          </Tabs>

          {incomesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : incomes && incomes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell className="text-sm">
                        {format(new Date(income.incomeDate), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            income.type === "dividendo"
                              ? "bg-blue-500/10 text-blue-600"
                              : income.type === "jcp"
                                ? "bg-purple-500/10 text-purple-600"
                                : income.type === "rendimento"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-gray-500/10 text-gray-600"
                          }`}
                        >
                          {income.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{income.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{income.category}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(Number(income.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhuma receita registrada</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
