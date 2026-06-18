import { execSync } from "child_process";

export interface ParsedDividend {
  ticker: string;
  type: "dividendo" | "jcp" | "rendimento" | "amortizacao";
  paymentDate: Date;
  quantity: number;
  totalValue: number;
  valuePerShare: number;
}

/**
 * Extrai proventos de um PDF da XP Investimentos
 * Procura pela seção "Proventos" e mapeia os dados
 * 
 * Formato esperado do pdftotext:
 * Proventos
 * 0.31% | Ações
 * Ativo    Indexador    Data Provisão Pagamento    Quantidade Provisionada    Provisionado
 * BBDC4    JURO    01/06/2026    1042    R$ 19,77
 * BBDC4    JUROS SOBRE CAPITAL PROPRIO    31/07/2026    10    R$ 3,86
 */
export function parseXPDividendsPDF(pdfPath: string): ParsedDividend[] {
  try {
    // Converter PDF para texto usando pdftotext
    const pdfText = execSync(`pdftotext "${pdfPath}" -`, { encoding: "utf-8" });

    // Buscar seção de Proventos
    const proventosMatch = pdfText.match(
      /Proventos[\s\S]*?(?=PRÓXIMOS|DISTRIBUIÇÃO|$)/i
    );
    if (!proventosMatch) {
      console.warn("[parseXPDividendsPDF] Seção Proventos não encontrada");
      return [];
    }

    const proventosSection = proventosMatch[0];
    const lines = proventosSection.split("\n").map((line) => line.trim()).filter((line) => line);

    // Encontrar a linha de header (contém "Ativo" e "Indexador")
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Ativo") && lines[i].includes("Indexador")) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      console.warn("[parseXPDividendsPDF] Header não encontrado");
      return [];
    }

    const dividends: ParsedDividend[] = [];

    // Processar linhas após o header
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      // Parar se encontrar uma seção vazia ou nova seção
      if (!line || line.match(/^[A-Z\s]+$/) || line.includes("PRÓXIMOS") || line.includes("DISTRIBUIÇÃO")) {
        break;
      }

      // Tentar fazer parsing da linha
      // Exemplo: "BBDC4    JURO    01/06/2026    1042    R$ 19,77"
      // Usar regex para capturar os campos separados por múltiplos espaços
      const tickerMatch = line.match(/^([A-Z0-9]{4,6})\s+/);
      if (!tickerMatch) {
        continue;
      }

      const ticker = tickerMatch[1];
      const restOfLine = line.substring(tickerMatch[0].length).trim();

      // Dividir o resto da linha por múltiplos espaços
      const parts = restOfLine.split(/\s{2,}/).map((p) => p.trim());

      if (parts.length < 4) {
        continue;
      }

      try {
        const typeRaw = parts[0].toUpperCase();
        const dateStr = parts[1];
        const quantityStr = parts[2];
        const valueStr = parts[3];

        // Mapear tipo
        let type: "dividendo" | "jcp" | "rendimento" | "amortizacao" = "dividendo";
        if (
          typeRaw.includes("JURO") ||
          typeRaw.includes("JUROS SOBRE CAPITAL")
        ) {
          type = "jcp";
        } else if (typeRaw.includes("DIVI")) {
          type = "dividendo";
        } else if (typeRaw.includes("RENDIMENTO")) {
          type = "rendimento";
        } else if (typeRaw.includes("AMORTIZA")) {
          type = "amortizacao";
        }

        // Parsear data (DD/MM/YYYY)
        const dateParts = dateStr.split("/");
        if (dateParts.length !== 3) {
          continue;
        }
        const paymentDate = new Date(
          parseInt(dateParts[2]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[0])
        );

        // Validar data
        if (isNaN(paymentDate.getTime())) {
          continue;
        }

        // Parsear quantidade
        const quantity = parseInt(quantityStr.replace(/\D/g, ""));
        if (isNaN(quantity) || quantity <= 0) {
          continue;
        }

        // Parsear valor (R$ 19,77 → 19.77)
        const valueMatch = valueStr.match(/R\$\s*([\d.,]+)/);
        if (!valueMatch) {
          continue;
        }
        const totalValue = parseFloat(
          valueMatch[1].replace(".", "").replace(",", ".")
        );
        if (isNaN(totalValue) || totalValue <= 0) {
          continue;
        }

        const valuePerShare = totalValue / quantity;

        dividends.push({
          ticker,
          type,
          paymentDate,
          quantity,
          totalValue,
          valuePerShare,
        });
      } catch (e) {
        // Ignorar linhas que não conseguem fazer parsing
        console.warn(`[parseXPDividendsPDF] Erro ao parsear linha: ${line}`, e);
      }
    }

    console.log(`[parseXPDividendsPDF] Extraídos ${dividends.length} proventos`);
    return dividends;
  } catch (error) {
    console.error("[parseXPDividendsPDF] Error:", error);
    return [];
  }
}

/**
 * Deduplicar dividendos por (ticker, type, paymentDate)
 */
export function deduplicateDividends(
  dividends: ParsedDividend[]
): ParsedDividend[] {
  const seen = new Set<string>();
  const result: ParsedDividend[] = [];

  for (const div of dividends) {
    const key = `${div.ticker}|${div.type}|${div.paymentDate.toISOString().split("T")[0]}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(div);
    }
  }

  return result;
}
