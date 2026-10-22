import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { decodeBase64, parseAdvisorDocument } from "../lib/advisorAttachmentParser";
import {
  buildWealthAdvisorSystemPrompt,
  buildWealthAdvisorUserPrompt,
  loadWealthAdvisorContext,
} from "../services/wealthAdvisorService";
import { protectedProcedure, router } from "../_core/trpc";

const MAX_DOCUMENT_BASE64_CHARACTERS = 12 * 1024 * 1024;
const MAX_AUDIO_BASE64_CHARACTERS = 18 * 1024 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

const audioMimeTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
]);

const inputSchema = z
  .object({
    question: z.string().trim().max(6_000, "A pergunta excede 6.000 caracteres.").optional(),
    document: z
      .object({
        name: z.string().trim().min(1, "Informe o nome do documento.").max(180),
        mimeType: z.string().trim().max(120).optional(),
        base64: z.string().max(MAX_DOCUMENT_BASE64_CHARACTERS, "O documento enviado é muito grande."),
      })
      .optional(),
    audio: z
      .object({
        name: z.string().trim().min(1, "Informe o nome do áudio.").max(180),
        mimeType: z.string().trim().min(1, "Informe o tipo do áudio.").max(120),
        base64: z.string().max(MAX_AUDIO_BASE64_CHARACTERS, "O áudio enviado é muito grande."),
      })
      .optional(),
  })
  .superRefine((input, context) => {
    if (!input.question && !input.document && !input.audio) {
      context.addIssue({ code: "custom", message: "Envie uma pergunta, documento ou áudio." });
    }
    if (input.document && input.audio) {
      context.addIssue({ code: "custom", message: "Envie documento ou áudio, não ambos." });
    }
    if (input.audio && !audioMimeTypes.has(input.audio.mimeType.toLowerCase())) {
      context.addIssue({ code: "custom", path: ["audio", "mimeType"], message: "Formato de áudio não suportado." });
    }
  });

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function llmContentToText(content: unknown): string | null {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is { type: "text"; text: string } =>
        typeof part === "object" && part !== null && part.type === "text" && typeof part.text === "string"
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

/**
 * Consultor patrimonial pontual: operação integralmente efêmera. Esta mutation
 * somente lê a carteira e o patrimônio já cadastrados; não grava entrada, anexo,
 * transcrição, resposta ou qualquer lançamento financeiro.
 */
export const wealthAdvisorRouter = router({
  ask: protectedProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
    let attachment: { name: string; kind: "document" | "audio"; extractedCharacters?: number } | undefined;
    let document: { name: string; text: string } | undefined;
    let transcript: string | undefined;

    if (input.document) {
      try {
        const buffer = decodeBase64(input.document.base64);
        const parsed = await parseAdvisorDocument(buffer, input.document.name);
        document = { name: input.document.name, text: parsed.text };
        attachment = {
          name: input.document.name,
          kind: "document",
          extractedCharacters: parsed.extractedCharacters,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível ler o documento.";
        throw badRequest(message);
      }
    }

    if (input.audio) {
      let audio: Buffer;
      try {
        audio = decodeBase64(input.audio.base64);
      } catch {
        throw badRequest("Base64 inválido.");
      }
      if (audio.length > MAX_AUDIO_BYTES) {
        throw badRequest("O áudio excede o limite de 12 MB.");
      }

      const mimeType = input.audio.mimeType.toLowerCase();
      const transcription = await transcribeAudio({
        audioUrl: `data:${mimeType};base64,${input.audio.base64}`,
        language: "pt",
        prompt: "Transcreva uma pergunta financeira em português do Brasil com fidelidade, incluindo nomes de ativos, valores e datas quando audíveis.",
      });
      if ("error" in transcription) {
        throw badRequest("Não foi possível transcrever o áudio.");
      }

      transcript = transcription.text.trim();
      if (!transcript) {
        throw badRequest("Não foi possível transcrever o áudio.");
      }
      attachment = { name: input.audio.name, kind: "audio" };
    }

    const context = await loadWealthAdvisorContext(ctx.user.id);
    const userPrompt = buildWealthAdvisorUserPrompt({
      context,
      question: input.question,
      document,
      transcript,
    });

    let analysis: string;
    try {
      const response = await invokeLLM({
        model: "gpt-6.1-sol",
        maxCompletionTokens: 1_200,
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: buildWealthAdvisorSystemPrompt() },
          { role: "user", content: userPrompt },
        ],
      });
      analysis = llmContentToText(response.choices?.[0]?.message?.content)
        ?? "Não foi possível gerar a análise agora. Tente novamente.";
    } catch (error) {
      console.error("[wealthAdvisor.ask] Falha ao gerar análise:", error instanceof Error ? error.message : "erro desconhecido");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível gerar a análise agora." });
    }

    return {
      analysis,
      generatedAt: context.generatedAt,
      ...(transcript ? { transcript } : {}),
      ...(attachment ? { attachment } : {}),
    };
  }),
});
