import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { FinancialDeleteConfirmDialog } from "@/components/FinancialDeleteConfirmDialog";
import { PrivacyMask } from "@/components/PrivacyMask";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Trash2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  dividendo_recebido: "Dividendo Recebido",
  vencimento_rf: "Vencimento RF",
  aporte_externo: "Aporte Externo",
  compra_ativo: "Compra de Ativo",
  resgate: "Resgate",
  taxa: "Taxa",
  outro: "Outro",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function CaixaCard() {
  const utils = trpc.useUtils();
  const { showBalances } = useBalanceVisibility();
  const [open, setOpen] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [category, setCategory] = useState<string>("aporte_externo");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [movementPendingDeletion, setMovementPendingDeletion] = useState<{
    id: number;
    category: string;
    amount: number;
    type: "entrada" | "saida";
  } | null>(null);

  const { data: balance, isLoading: loadingBalance } = trpc.cash.getBalance.useQuery(undefined, { enabled: showBalances });
  const { data: movements, isLoading: loadingMovements } = trpc.cash.listMovements.useQuery(
    { limit: 10 },
    { enabled: showBalances }
  );

  const addMovement = trpc.cash.addMovement.useMutation({
    onSuccess: (data) => {
      utils.cash.getBalance.invalidate();
      utils.cash.listMovements.invalidate();
      toast.success(showBalances ? `Movimentação registrada — Novo saldo: ${formatCurrency(data.newBalance)}` : "Movimentação registrada");
      setOpen(false);
      setAmount("");
      setDescription("");
    },
    onError: () => {
      toast.error("Erro ao registrar movimentação");
    },
  });

  const deleteMovement = trpc.cash.deleteMovement.useMutation({
    onSuccess: () => {
      utils.cash.getBalance.invalidate();
      utils.cash.listMovements.invalidate();
      toast.success("Movimentação removida");
      setMovementPendingDeletion(null);
    },
  });

  const handleSubmit = () => {
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    addMovement.mutate({
      type,
      category: category as any,
      amount: amt,
      description: description || undefined,
      date,
    });
  };

  const currentBalance = balance?.balance ?? 0;

  if (!showBalances) {
    return (
      <Card className="bg-card/50 border-border/50 shadow-sm card-interactive">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Caixa disponível</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <PrivacyMask className="text-base font-bold font-mono text-muted-foreground">
            Conteúdo financeiro oculto
          </PrivacyMask>
          <p className="mt-1 text-xs text-muted-foreground">Mostre os valores para consultar ou registrar movimentações.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm card-interactive">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Caixa Disponível
        </CardTitle>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <IconButton
                variant="ghost"
                aria-label="Registrar movimentação de caixa"
                className="h-6 w-6"
              >
                <Plus className="h-3 w-3" />
              </IconButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Movimentação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Tipo */}
                <div className="flex gap-2">
                  <Button
                    variant={type === "entrada" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setType("entrada")}
                  >
                    <ArrowUpCircle className="h-4 w-4 mr-2 text-emerald-500" />
                    Entrada
                  </Button>
                  <Button
                    variant={type === "saida" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setType("saida")}
                  >
                    <ArrowDownCircle className="h-4 w-4 mr-2 text-destructive" />
                    Saída
                  </Button>
                </div>

                {/* Categoria */}
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Valor */}
                <Input
                  placeholder="Valor (R$)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />

                {/* Data */}
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />

                {/* Descrição */}
                <Input
                  placeholder="Descrição (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={addMovement.isPending}
                >
                  {addMovement.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Registrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Saldo */}
        <div className="text-sm font-bold font-mono leading-tight sm:text-base md:text-xl">
          {loadingBalance ? (
            <span className="text-muted-foreground text-lg">Carregando...</span>
          ) : (
            formatCurrency(currentBalance)
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em + para registrar movimentação
        </p>

        {/* Últimas movimentações */}
        {!loadingMovements && movements && movements.length > 0 && (
          <div className="mt-4 space-y-1">
            <button
              onClick={() => setShowMovements((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full text-left"
            >
              {showMovements ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Últimas Movimentações
            </button>
            {showMovements && movements.slice(0, 5).map((mov) => (
              <div
                key={mov.id}
                className="group py-1 border-b border-border/20 last:border-0"
              >
                {/* Linha 1: ícone + categoria + botão excluir */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {mov.type === "entrada" ? (
                      <ArrowUpCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <p className="text-xs font-medium truncate">
                      {CATEGORY_LABELS[mov.category] ?? mov.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        mov.type === "entrada"
                          ? "text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {mov.type === "entrada" ? "+" : "-"}
                      {formatCurrency(Number(mov.amount))}
                    </span>
                    <IconButton
                      variant="ghost"
                      aria-label={`Excluir movimentação: ${CATEGORY_LABELS[mov.category] ?? mov.category}`}
                      className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                      onClick={() => setMovementPendingDeletion({
                        id: mov.id,
                        category: mov.category,
                        amount: Number(mov.amount),
                        type: mov.type,
                      })}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </IconButton>
                  </div>
                </div>
                {/* Linha 2: descrição (sem truncamento) */}
                {mov.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 pl-5 leading-snug break-words">
                    {mov.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <FinancialDeleteConfirmDialog
        open={movementPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMovement.isPending) setMovementPendingDeletion(null);
        }}
        title="Excluir movimentação de caixa"
        itemLabel={movementPendingDeletion
          ? `${movementPendingDeletion.type === "entrada" ? "entrada" : "saída"} de ${formatCurrency(movementPendingDeletion.amount)} — ${CATEGORY_LABELS[movementPendingDeletion.category] ?? movementPendingDeletion.category}`
          : "esta movimentação"}
        consequence="O saldo de caixa será recalculado sem esta movimentação."
        onConfirm={() => {
          if (!movementPendingDeletion) return;
          deleteMovement.mutate({ id: movementPendingDeletion.id });
        }}
        isPending={deleteMovement.isPending}
      />
    </Card>
  );
}
