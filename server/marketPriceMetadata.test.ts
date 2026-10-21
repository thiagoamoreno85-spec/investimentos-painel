import { describe, expect, it } from "vitest";
import { getPriceMetadataLabel } from "../shared/marketPriceMetadata";

describe("metadados de preço", () => {
  it("expõe a ausência de proveniência de valores legados", () => {
    expect(getPriceMetadataLabel({ currency: "BRL" })).toContain("Legado sem fonte");
  });

  it("identifica preço manual pela data-base", () => {
    expect(getPriceMetadataLabel({ currency: "BRL", source: "Manual", state: "manual", referenceDate: "2026-10-21" })).toContain("Manual");
  });
});
