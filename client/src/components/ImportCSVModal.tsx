import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCSVModal({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { mutate: importCSV, isPending } = trpc.portfolio.importCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ Importação concluída: ${data.imported} transações importadas (formato: ${data.format}). ${data.skipped > 0 ? `${data.skipped} ignoradas (duplicadas).` : ''}`);
      utils.portfolio.invalidate();
      setFile(null);
      setPreview(null);
      onClose();
    },
    onError: (err) => {
      toast.error(`❌ Erro na importação: ${err.message}`);
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(text.split('\n').slice(0, 3).join('\n'));
    };
    reader.readAsText(f, 'utf-8');
  };

  const handleImport = async () => {
    if (!file) return;
    const text = await file.text();
    importCSV({ csvContent: text });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Transações via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Formatos suportados: <strong>B3, XP, Rico, Clear</strong>
          </p>

          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</p>
              {file && <p className="text-sm font-medium mt-2 text-emerald-400">📄 {file.name}</p>}
            </label>
          </div>

          {preview && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Preview (3 primeiras linhas):</p>
              <pre className="text-xs overflow-x-auto">{preview}</pre>
            </div>
          )}

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 space-y-1">
            <p>📌 <strong>Como exportar:</strong></p>
            <p>• <strong>B3:</strong> Canal Eletrônico do Investidor → Extratos → Negociação</p>
            <p>• <strong>XP/Rico/Clear:</strong> Área logada → Relatórios → Notas de Corretagem → Exportar CSV</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!file || isPending}>
              {isPending ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
