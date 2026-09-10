export type MonthlyPriceReference = {
  price: number;
  date: string;
};

export type MonthlyPriceChange = MonthlyPriceReference & {
  change: number;
  changePercent: number;
};

function brtMonthStart(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-01`;
}

/** Último fechamento disponível antes do mês corrente, no horário de São Paulo. */
export function getMonthlyPriceReference(
  closesByDate: Map<string, number>,
  now = new Date()
): MonthlyPriceReference | null {
  const monthStart = brtMonthStart(now);
  let reference: MonthlyPriceReference | null = null;

  for (const [date, close] of Array.from(closesByDate.entries())) {
    if (!Number.isFinite(close) || close <= 0 || date >= monthStart) continue;
    if (!reference || date > reference.date) reference = { price: close, date };
  }

  return reference;
}

/** Retorno de preço no mês corrente; não inclui proventos, aportes, custos ou efeito cambial. */
export function calculateMonthlyPriceChange(
  currentPrice: number,
  closesByDate: Map<string, number>,
  now = new Date()
): MonthlyPriceChange | null {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  const reference = getMonthlyPriceReference(closesByDate, now);
  if (!reference) return null;

  const change = currentPrice - reference.price;
  return {
    ...reference,
    change,
    changePercent: (change / reference.price) * 100,
  };
}
