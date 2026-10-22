import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Mic, Paperclip, Send, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { IconButton } from "@/components/IconButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";
import { trpc } from "@/lib/trpc";

type Attachment = {
  name: string;
  base64: string;
  mimeType: string;
  kind: "document" | "audio";
};

type AdvisorResponse = {
  analysis: string;
  generatedAt: string;
  transcript?: string;
  attachment?: {
    name: string;
    kind: "document" | "audio";
    extractedCharacters?: number;
  };
};

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".pdf,.txt,.csv,.xlsx,.xls,.docx,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SUGGESTED_QUESTIONS = [
  "Quais riscos devo observar na minha carteira neste cenário?",
  "Como uma queda de mercado pode afetar minha alocação?",
  "Analise este comunicado e os pontos a monitorar.",
];

function getExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot + 1).toLowerCase();
}

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const separator = value.indexOf(",");
      if (separator === -1) {
        reject(new Error("Não foi possível preparar o arquivo."));
        return;
      }
      resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

function bestSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
}

export function WealthAdvisorBox() {
  const { showBalances } = useBalanceVisibility();
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const showBalancesRef = useRef(showBalances);
  const [question, setQuestion] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [answer, setAnswer] = useState<AdvisorResponse | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparingAttachment, setIsPreparingAttachment] = useState(false);

  const askAdvisor = trpc.wealthAdvisor.ask.useMutation({
    onSuccess: (data) => {
      setAnswer(data);
      setQuestion("");
      setAttachment(null);
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível gerar a análise agora.");
    },
  });

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMediaStream();
  }, []);

  useEffect(() => {
    showBalancesRef.current = showBalances;
    if (showBalances) return;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMediaStream();
    setIsRecording(false);
    setQuestion("");
    setAttachment(null);
    setAnswer(null);
  }, [showBalances]);

  const clearAttachment = () => {
    if (isRecording) return;
    setAttachment(null);
  };

  const handleDocument = async (file: File | undefined) => {
    if (!file) return;

    const extension = getExtension(file.name);
    if (!["pdf", "txt", "csv", "xlsx", "xls", "docx"].includes(extension)) {
      toast.error("Formato não suportado. Envie PDF, TXT, CSV, XLSX, XLS ou DOCX.");
      return;
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      toast.error("O documento deve ter até 8 MB e não pode estar vazio.");
      return;
    }

    try {
      setIsPreparingAttachment(true);
      const base64 = await toBase64(file);
      setAttachment({
        name: file.name,
        base64,
        mimeType: file.type || "application/octet-stream",
        kind: "document",
      });
      setAnswer(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar o documento.");
    } finally {
      setIsPreparingAttachment(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    if (!showBalances || askAdvisor.isPending || isPreparingAttachment) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("A gravação de áudio não é compatível com este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = bestSupportedAudioMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        stopMediaStream();
        setIsRecording(false);
        toast.error("Não foi possível gravar o áudio.");
      };
      recorder.onstop = async () => {
        stopMediaStream();
        setIsRecording(false);
        if (!showBalancesRef.current) return;
        const mimeType = (recorder.mimeType || preferredMimeType || "audio/webm").split(";")[0].toLowerCase();
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) {
          toast.error("Nenhum áudio foi capturado.");
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          toast.error("O áudio deve ter até 12 MB.");
          return;
        }

        try {
          setIsPreparingAttachment(true);
          const base64 = await toBase64(blob);
          const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "m4a" : "webm";
          setAttachment({
            name: `pergunta-gravada.${extension}`,
            base64,
            mimeType,
            kind: "audio",
          });
          setAnswer(null);
        } catch {
          toast.error("Não foi possível preparar o áudio.");
        } finally {
          setIsPreparingAttachment(false);
        }
      };

      mediaStreamRef.current = stream;
      recorderRef.current = recorder;
      setAttachment(null);
      setAnswer(null);
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Permita o uso do microfone para gravar a pergunta.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const submitQuestion = () => {
    if (!showBalances) return;
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion && !attachment) {
      toast.error("Escreva uma pergunta, grave um áudio ou anexe um documento.");
      return;
    }
    if (isRecording) {
      toast.error("Conclua a gravação antes de enviar.");
      return;
    }

    askAdvisor.mutate({
      ...(trimmedQuestion ? { question: trimmedQuestion } : {}),
      ...(attachment?.kind === "document"
        ? { document: { name: attachment.name, mimeType: attachment.mimeType, base64: attachment.base64 } }
        : {}),
      ...(attachment?.kind === "audio"
        ? { audio: { name: attachment.name, mimeType: attachment.mimeType, base64: attachment.base64 } }
        : {}),
    });
  };

  if (!showBalances) {
    return (
      <Card className="border-dashed border-border bg-card/50">
        <CardContent className="flex min-h-20 items-center gap-3 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Consultor patrimonial protegido</p>
            <p className="text-sm text-muted-foreground">Mostre os valores para enviar uma pergunta com o contexto da sua carteira.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isBusy = askAdvisor.isPending || isPreparingAttachment;
  const attachmentLabel = attachment?.kind === "audio" ? "Áudio pronto para transcrição" : "Documento pronto para análise";

  return (
    <Card className="border-primary/20 bg-card/60 shadow-sm">
      <CardContent className="p-3 md:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Consultor patrimonial pontual</h2>
              <p className="truncate text-xs text-muted-foreground">Dúvidas sobre mercado, quedas, altas, riscos e impactos na carteira.</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Somente análise — sem ordens</span>
        </div>

        <form onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }} className="space-y-2">
          <div className="flex items-end gap-2">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
              aria-label="Pergunta para o consultor patrimonial"
              aria-describedby="wealth-advisor-notice"
              placeholder="Ex.: O que devo monitorar se este ativo cair 10%?"
              className="min-h-10 max-h-28 resize-y py-2 text-sm"
              rows={1}
              disabled={isBusy || isRecording}
            />
            <input
              ref={inputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(event) => void handleDocument(event.target.files?.[0])}
              disabled={isBusy || isRecording}
              aria-label="Anexar documento para análise"
            />
            <IconButton
              type="button"
              variant="outline"
              aria-label="Anexar documento"
              title="Anexar PDF, TXT, CSV, XLSX, XLS ou DOCX"
              onClick={() => inputRef.current?.click()}
              disabled={isBusy || isRecording}
              className="h-10 w-10 shrink-0"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              type="button"
              variant={isRecording ? "destructive" : "outline"}
              aria-label={isRecording ? "Parar gravação" : "Gravar pergunta por áudio"}
              title={isRecording ? "Parar gravação" : "Gravar pergunta por áudio"}
              onClick={isRecording ? stopRecording : () => void startRecording()}
              disabled={isBusy}
              className="h-10 w-10 shrink-0"
            >
              {isRecording ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
            <IconButton
              type="submit"
              aria-label={isBusy ? "Analisando pergunta" : "Enviar pergunta ao consultor"}
              title="Enviar pergunta"
              disabled={isBusy || isRecording || (!question.trim() && !attachment)}
              className="h-10 w-10 shrink-0"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
          </div>

          {isRecording && (
            <p className="flex items-center gap-2 text-sm text-red-300" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" aria-hidden="true" />
              Gravando. Selecione o botão quadrado para concluir.
            </p>
          )}

          {attachment && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-secondary/30 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                {attachment.kind === "audio" ? <Mic className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                <span className="truncate"><span className="font-medium">{attachmentLabel}:</span> {attachment.name}</span>
              </div>
              <IconButton type="button" variant="ghost" aria-label="Remover anexo" title="Remover anexo" onClick={clearAttachment} disabled={isBusy} className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          )}

          <div className="flex flex-wrap gap-2" aria-label="Perguntas sugeridas">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  setAnswer(null);
                }}
                disabled={isBusy || isRecording}
                className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>

        <p id="wealth-advisor-notice" className="mt-2 text-xs text-muted-foreground">
          Processamento temporário: a resposta usa dados cadastrados e o anexo desta solicitação, sem salvar conversa ou documento. Não há busca automática de cotações ou notícias externas. Não envie senhas, chaves ou dados de acesso.
        </p>

        {answer && (
          <section className="mt-3 rounded-lg border border-border/70 bg-background/30" aria-labelledby="wealth-advisor-response-title">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <h3 id="wealth-advisor-response-title" className="text-sm font-semibold">Análise orientativa</h3>
              <span className="text-xs text-muted-foreground">Gerada em {new Date(answer.generatedAt).toLocaleString("pt-BR")}</span>
            </div>
            {answer.transcript && (
              <p className="border-b border-border/60 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Transcrição:</span> {answer.transcript}
              </p>
            )}
            <ScrollArea className="max-h-[32rem]">
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 text-sm">
                <Streamdown>{answer.analysis}</Streamdown>
              </div>
            </ScrollArea>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
