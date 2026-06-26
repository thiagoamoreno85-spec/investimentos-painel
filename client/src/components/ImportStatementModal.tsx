import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type PreviewItem = {
  ticker: string;
  assetId?: number;
  type: string;
  totalValue: number;
  paymentDate: Date;
  description: string;
  found: boolean;
  duplicate: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  dividendo: "Dividendo",
  jcp: "JCP",
  rendimento: "Rendimento",
  outro: "Outro",
};

export function ImportStatementModal({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [result, setResult] = useState<{
    imported: number;
    skippedDuplicate: number;
    skippedNotFound: number;
    notFoundTickers: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMutation = trpc.dividends.previewDividendsFromStatement.useMutation({
    onSuccess: (data) => {
      setPreview(data.preview);
      // Pré-selecionar apenas os não-duplicados e encontrados
      const indices = data.preview
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item.found && !item.duplicate)
        .map(({ i }) => i);
      setSelectedIndices(indices);
      setStep("preview");
    },
    onError: (err) => toast.error(`Erro ao processar extrato: ${err.message}`),
  });

  const importMutation = trpc.dividends.importDividendsFromStatement.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      onImported();
    },
    onError: (err) => toast.error(`Erro ao importar: ${err.message}`),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(f);
  }

  function handlePreview() {
    if (!fileBase64) return;
    previewMutation.mutate({ fileBase64 });
  }

  function handleImport() {
    if (!fileBase64) return;
    importMutation.mutate({ fileBase64, selectedIndices });
  }

  function toggleIndex(i: number) {
    setSelectedIndices((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  }

  function handleClose() {
    setFile(null);
    setFileBase64(null);
    setPreview(null);
    setSelectedIndices([]);
    setStep("upload");
    setResult(null);
    onClose();
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("pt-BR");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Importar Extrato XP (XLSX)
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça upload do extrato de conta corrente da XP em formato <strong>.xlsx</strong>. O sistema
              identificará automaticamente os proventos (dividendos, JCP, rendimentos de FII) e ignorará
              lançamentos já registrados.
            </p>

            <div
              className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste o arquivo aqui ou <span className="text-emerald-400 underline">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .xlsx</p>
              {file && (
                <p className="text-sm font-medium mt-3 text-emerald-400">
                  📊 {file.name}
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFile}
                className="hidden"
              />
            </div>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 space-y-1">
              <p>📌 <strong>Como exportar o extrato da XP:</strong></p>
              <p>• Acesse a área logada da XP → <strong>Extrato</strong> → selecione o período → <strong>Exportar XLSX</strong></p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handlePreview}
                disabled={!fileBase64 || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                ) : (
                  "Analisar Extrato"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{preview.filter((p) => p.found && !p.duplicate).length}</strong> novos proventos encontrados.{" "}
                <strong>{preview.filter((p) => p.duplicate).length}</strong> já lançados (ignorados).{" "}
                {preview.filter((p) => !p.found).length > 0 && (
                  <span className="text-yellow-400">
                    <strong>{preview.filter((p) => !p.found).length}</strong> ativos não cadastrados.
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newIndices = preview
                    .map((item, i) => ({ item, i }))
                    .filter(({ item }) => item.found && !item.duplicate)
                    .map(({ i }) => i);
                  setSelectedIndices(newIndices);
                }}
                className="text-xs"
              >
                Selecionar todos novos
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {preview.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    item.duplicate
                      ? "border-muted/30 bg-muted/10 opacity-50 cursor-not-allowed"
                      : !item.found
                      ? "border-yellow-500/30 bg-yellow-500/5 cursor-not-allowed"
                      : selectedIndices.includes(i)
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border/50 bg-card/50 hover:border-emerald-500/30"
                  }`}
                  onClick={() => {
                    if (!item.duplicate && item.found) toggleIndex(i);
                  }}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {item.duplicate ? (
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    ) : !item.found ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    ) : selectedIndices.includes(i) ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Ticker + tipo */}
                  <div className="flex-shrink-0 w-20">
                    <span className="font-mono font-bold">{item.ticker}</span>
                    <Badge variant="outline" className="ml-1 text-xs py-0 px-1">
                      {TYPE_LABELS[item.type] || item.type}
                    </Badge>
                  </div>

                  {/* Data */}
                  <div className="flex-shrink-0 w-24 text-muted-foreground text-xs">
                    {formatDate(item.paymentDate)}
                  </div>

                  {/* Valor */}
                  <div className="flex-1 font-mono text-emerald-400 font-medium">
                    {formatCurrency(item.totalValue)}
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0">
                    {item.duplicate && (
                      <Badge variant="secondary" className="text-xs">Já lançado</Badge>
                    )}
                    {!item.found && !item.duplicate && (
                      <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                        Não cadastrado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedIndices.length === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                  ) : (
                    `Importar ${selectedIndices.length} provento${selectedIndices.length !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === "done" && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold">Importação Concluída!</h3>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <p className="text-2xl font-bold text-emerald-400">{result.imported}</p>
                <p className="text-muted-foreground">Importados</p>
              </div>
              <div className="rounded-lg bg-muted/20 border border-border/30 p-3">
                <p className="text-2xl font-bold text-muted-foreground">{result.skippedDuplicate}</p>
                <p className="text-muted-foreground">Já lançados</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                <p className="text-2xl font-bold text-yellow-400">{result.skippedNotFound}</p>
                <p className="text-muted-foreground">Não cadastrados</p>
              </div>
            </div>

            {result.notFoundTickers.length > 0 && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-left text-xs text-yellow-300">
                <p className="font-medium mb-1">Ativos não encontrados na carteira:</p>
                <p>{result.notFoundTickers.join(", ")}</p>
                <p className="mt-1 text-muted-foreground">
                  Cadastre esses ativos na página de Transações para importar seus proventos.
                </p>
              </div>
            )}

            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
