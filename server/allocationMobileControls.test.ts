import { describe, expect, it } from "vitest";
import {
  ALLOCATION_MOBILE_SORT_OPTIONS,
  parseAllocationMobileSort,
} from "@shared/allocationMobileControls";

describe("controles da lista móvel de alocação", () => {
  it("oferece as opções essenciais de ordenação", () => {
    expect(ALLOCATION_MOBILE_SORT_OPTIONS.map((option) => option.value)).toEqual([
      "totalValue:desc",
      "totalValue:asc",
      "profitPercentage:desc",
      "profitPercentage:asc",
      "name:asc",
    ]);
  });

  it("converte a seleção de ordenação para estado seguro", () => {
    expect(parseAllocationMobileSort("profitPercentage:asc")).toEqual({
      key: "profitPercentage",
      direction: "asc",
    });
  });

  it("recupera a ordenação por maior valor para uma seleção inválida", () => {
    expect(parseAllocationMobileSort("valor-inválido")).toEqual({
      key: "totalValue",
      direction: "desc",
    });
  });
});
