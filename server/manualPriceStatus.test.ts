import { describe, expect, it } from "vitest";
import { getManualPriceFreshness } from "@shared/manualPriceStatus";

describe("getManualPriceFreshness", () => {
  const now = new Date("2026-09-04T12:00:00Z");

  it("classifica marcações de até quatorze dias como atuais", () => {
    expect(getManualPriceFreshness("2026-08-21T00:00:00Z", now)).toEqual({
      status: "atual",
      ageInDays: 14,
    });
  });

  it("sinaliza revisão em breve entre quinze e trinta dias", () => {
    expect(getManualPriceFreshness("2026-08-05T00:00:00Z", now)).toEqual({
      status: "atencao",
      ageInDays: 30,
    });
  });

  it("sinaliza preço desatualizado após trinta dias ou sem data-base", () => {
    expect(getManualPriceFreshness("2026-08-04T00:00:00Z", now)).toEqual({
      status: "desatualizado",
      ageInDays: 31,
    });
    expect(getManualPriceFreshness(null, now)).toEqual({ status: "sem_data", ageInDays: null });
  });
});
