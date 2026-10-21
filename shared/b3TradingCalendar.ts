export type B3TradingCalendar = {
  year: number;
  listedExchangeClosedDates: readonly string[];
  sourceUrl: string;
  sourceDocument: string;
  publishedAt: string;
  notes: string;
};

/**
 * Calendário de sessões fechadas do mercado listado da B3 em 2026.
 * Fonte primária: Ofício Circular 041/2026-VNC (errata de 30/06/2026),
 * que revogou integralmente o OC 003/2026-VNC. Dias com expediente
 * especial não entram como fechamento integral.
 */
export const B3_TRADING_CALENDAR_2026: B3TradingCalendar = {
  year: 2026,
  listedExchangeClosedDates: [
    "2026-01-01",
    "2026-02-16",
    "2026-02-17",
    "2026-04-03",
    "2026-04-21",
    "2026-05-01",
    "2026-06-04",
    "2026-09-07",
    "2026-10-12",
    "2026-11-02",
    "2026-11-20",
    "2026-12-24",
    "2026-12-25",
    "2026-12-31",
  ],
  sourceUrl: "https://www.b3.com.br/data/files/20/57/01/AA/06A1F910ADC36BE9AC094EA8/OC%20041-2026-VNC%20ERRATA%20-%20CALENDARIO%20DE%20FERIADOS%20EM%202026_PT.pdf",
  sourceDocument: "Ofício Circular 041/2026-VNC — Errata: Calendário de feriados em 2026",
  publishedAt: "2026-06-30",
  notes: "Aplicável ao mercado listado. Feriados dos EUA e regras de balcão, câmbio e CSD2 são tratados separadamente e não equivalem, por si só, a fechamento integral da bolsa.",
};

const CALENDARS: Record<number, B3TradingCalendar> = {
  2026: B3_TRADING_CALENDAR_2026,
};

function toLocalDate(value: string): Date {
  return new Date(`${value}T12:00:00-03:00`);
}

export function getB3TradingCalendar(year: number): B3TradingCalendar | null {
  return CALENDARS[year] ?? null;
}

/** Verdadeiro somente em dia útil com sessão regular do mercado listado conhecida. */
export function isB3ListedTradingDay(date: string): boolean {
  const value = toLocalDate(date);
  const weekday = value.getDay();
  if (weekday === 0 || weekday === 6) return false;
  const calendar = getB3TradingCalendar(value.getFullYear());
  return !calendar?.listedExchangeClosedDates.includes(date);
}

/** Datas de pregão do mercado listado no intervalo inclusivo. */
export function getB3ListedTradingDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (
    let current = toLocalDate(startDate), end = toLocalDate(endDate);
    current <= end;
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const date = current.toISOString().slice(0, 10);
    if (isB3ListedTradingDay(date)) dates.push(date);
  }
  return dates;
}
