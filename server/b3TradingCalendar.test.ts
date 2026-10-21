import { describe, expect, it } from "vitest";
import {
  B3_TRADING_CALENDAR_2026,
  getB3ListedTradingDates,
  isB3ListedTradingDay,
} from "../shared/b3TradingCalendar";

describe("b3 trading calendar 2026", () => {
  it("exclui feriado nacional do mercado listado", () => {
    expect(isB3ListedTradingDay("2026-10-12")).toBe(false);
    expect(isB3ListedTradingDay("2026-10-13")).toBe(true);
  });

  it("exclui fins de semana e mantém sessões regulares", () => {
    expect(isB3ListedTradingDay("2026-10-10")).toBe(false);
    expect(isB3ListedTradingDay("2026-10-09")).toBe(true);
  });

  it("retorna somente pregões no intervalo inclusivo", () => {
    expect(getB3ListedTradingDates("2026-10-09", "2026-10-13")).toEqual([
      "2026-10-09",
      "2026-10-13",
    ]);
  });

  it("mantém fonte documental e não classifica feriados dos EUA como fechamento geral", () => {
    expect(B3_TRADING_CALENDAR_2026.sourceUrl).toContain("b3.com.br");
    expect(B3_TRADING_CALENDAR_2026.listedExchangeClosedDates).not.toContain("2026-11-11");
  });
});
