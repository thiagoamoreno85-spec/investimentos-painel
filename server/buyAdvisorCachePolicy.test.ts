import { describe, expect, it } from "vitest";
import { buildBuyAdvisorCachePayload } from "@shared/buyAdvisorCachePolicy";

const base = {
  availableAmount: "1200.00",
  focus: "brasil" as const,
  userContext: "",
  assets: [{
    id: 1,
    ticker: "VALE3",
    quantity: "100.00000000",
    averageCost: "50.00000000",
    price: "60.00000000",
    updatedAt: "2026-10-21T12:00:00.000Z",
  }],
};

describe("cache da triagem de compra", () => {
  it("é determinístico independentemente da ordem dos ativos", () => {
    const reversed = { ...base, assets: [...base.assets, { ...base.assets[0], id: 2, ticker: "PETR4" }].reverse() };
    const ordered = { ...base, assets: [...reversed.assets].reverse() };
    expect(buildBuyAdvisorCachePayload(reversed)).toBe(buildBuyAdvisorCachePayload(ordered));
  });

  it("muda quando muda o orçamento ou a posição/preço", () => {
    expect(buildBuyAdvisorCachePayload({ ...base, availableAmount: "1500.00" }))
      .not.toBe(buildBuyAdvisorCachePayload(base));
    expect(buildBuyAdvisorCachePayload({ ...base, assets: [{ ...base.assets[0], price: "61.00000000" }] }))
      .not.toBe(buildBuyAdvisorCachePayload(base));
  });
});
