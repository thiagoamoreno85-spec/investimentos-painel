import { describe, expect, it } from "vitest";
import { summarizeExternalCapitalFlows } from "../shared/externalCapitalFlow";

describe("summarizeExternalCapitalFlows", () => {
  it("separa aportes e retiradas externas sem misturar eventos internos", () => {
    const summary = summarizeExternalCapitalFlows([
      { type: "entrada", category: "aporte_externo", amount: "1000.00" },
      { type: "saida", category: "retirada_externa", amount: 250 },
      { type: "entrada", category: "dividendo_recebido", amount: 45.2 },
      { type: "entrada", category: "resgate", amount: 800 },
      { type: "saida", category: "compra_ativo", amount: 500 },
      { type: "saida", category: "outro", amount: 1200 },
    ]);

    expect(summary).toEqual({
      contributionsBRL: 1000,
      withdrawalsBRL: 250,
      netExternalFlowBRL: 750,
    });
  });

  it("ignora movimentos com sentido incompatível ou valor inválido", () => {
    const summary = summarizeExternalCapitalFlows([
      { type: "saida", category: "aporte_externo", amount: 500 },
      { type: "entrada", category: "retirada_externa", amount: 300 },
      { type: "entrada", category: "aporte_externo", amount: "invalido" },
    ]);

    expect(summary).toEqual({
      contributionsBRL: 0,
      withdrawalsBRL: 0,
      netExternalFlowBRL: 0,
    });
  });
});
