import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Download,
  Database,
  Info,
  LogOut,
  Layers,
  DollarSign,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ASSET_CLASS_LABELS, classColor } from "@/lib/assetClasses";

export default function Configuracoes() {
  const { user, logout } = useAuth();
  const { data: dbAssets } = trpc.portfolio.getAssets.useQuery();
  const { data: usdBrlData } = trpc.portfolio.getUsdBrl.useQuery();

  const stats = useMemo(() => {
    if (!dbAssets || dbAssets.length === 0) return { count: 0, classes: [] as string[] };
    const classes = Array.from(new Set(dbAssets.map((a) => a.assetClass)));
    return { count: dbAssets.length, classes };
  }, [dbAssets]);

  function exportCSV() {
    if (!dbAssets || dbAssets.length === 0) {
      toast.error("Nenhum ativo para exportar.");
      return;
    }
    const header = "ticker;nome;classe;moeda;quantidade;custo_medio;ultimo_preco";
    const rows = dbAssets.map((a) =>
      [
        a.ticker,
        `"${(a.name ?? "").replace(/"/g, '""')}"`,
        ASSET_CLASS_LABELS[a.assetClass] ?? a.assetClass,
        a.currency ?? "BRL",
        a.totalQuantity,
        a.averageCost,
        a.lastPrice,
      ].join(";")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `carteira-manusinvest-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${dbAssets.length} ativos exportados em CSV.`);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Perfil, dados da carteira e informações da plataforma.
          </p>
        </div>

        {/* ── Perfil ── */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-primary" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                {(user?.name ?? "T").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{user?.name ?? "Dr. Thiago Moreno"}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email ?? "—"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>

        {/* ── Carteira ── */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4 text-primary" />
              Dados da Carteira
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/40 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="w-3.5 h-3.5" />
                  <p className="text-xs">Ativos cadastrados</p>
                </div>
                <p className="text-xl font-bold font-mono mt-1">{stats.count}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/40 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-3.5 h-3.5" />
                  <p className="text-xs">USD/BRL atual</p>
                </div>
                <p className="text-xl font-bold font-mono mt-1">
                  {usdBrlData?.rate ? `R$ ${usdBrlData.rate.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>

            {stats.classes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Classes na carteira</p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.classes.map((cls) => (
                    <span
                      key={cls}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-secondary/60 border border-border/50"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: classColor(cls) }}
                        aria-hidden="true"
                      />
                      {ASSET_CLASS_LABELS[cls] ?? cls}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1">
              <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar carteira (CSV)
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Exporta ticker, nome, classe, moeda, quantidade, custo médio e último preço —
                compatível com Excel e Google Sheets.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Sobre ── */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4 text-primary" />
              Sobre a Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plataforma</dt>
                <dd className="font-medium">ManusInvest</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cotações</dt>
                <dd className="font-medium">Yahoo Finance · Banco Central do Brasil</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Atualização de preços</dt>
                <dd className="font-medium">Manual + cache de cotações</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Stack</dt>
                <dd className="font-medium font-mono text-xs">
                  React 19 · tRPC 11 · Drizzle · MySQL
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
