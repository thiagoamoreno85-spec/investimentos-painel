import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOCATION_MOBILE_SORT,
  parseAllocationMobileSortPreference,
} from "@/lib/allocationMobilePreferences";

describe("preferência de ordenação da alocação móvel", () => {
  it("restaura uma opção de ordenação reconhecida", () => {
    expect(parseAllocationMobileSortPreference("profitPercentage:asc")).toBe("profitPercentage:asc");
  });

  it("usa maior valor quando a preferência é inexistente ou inválida", () => {
    expect(parseAllocationMobileSortPreference(null)).toBe(DEFAULT_ALLOCATION_MOBILE_SORT);
    expect(parseAllocationMobileSortPreference("ordem-inválida")).toBe(DEFAULT_ALLOCATION_MOBILE_SORT);
  });
});
