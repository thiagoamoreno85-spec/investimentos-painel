export type ExternalCapitalMovement = {
  type: "entrada" | "saida";
  category: string;
  amount: number | string;
};

export type ExternalCapitalFlowSummary = {
  contributionsBRL: number;
  withdrawalsBRL: number;
  netExternalFlowBRL: number;
};

function finiteAmount(value: number | string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Separa capital novo/retirado do investidor do caixa gerado internamente.
 * Compras, vendas, resgates, proventos, taxas e conversões continuam sendo
 * eventos internos da carteira e não integram este demonstrativo.
 */
export function summarizeExternalCapitalFlows(
  movements: ExternalCapitalMovement[]
): ExternalCapitalFlowSummary {
  let contributionsBRL = 0;
  let withdrawalsBRL = 0;

  for (const movement of movements) {
    const amount = finiteAmount(movement.amount);
    if (movement.type === "entrada" && movement.category === "aporte_externo") {
      contributionsBRL += amount;
    }
    if (movement.type === "saida" && movement.category === "retirada_externa") {
      withdrawalsBRL += amount;
    }
  }

  return {
    contributionsBRL,
    withdrawalsBRL,
    netExternalFlowBRL: contributionsBRL - withdrawalsBRL,
  };
}
