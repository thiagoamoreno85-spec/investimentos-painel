export type AllocationMobileSortKey = "name" | "totalValue" | "profitPercentage";
export type AllocationMobileSortDirection = "asc" | "desc";

export type AllocationMobileSortOption = {
  value: string;
  label: string;
  key: AllocationMobileSortKey;
  direction: AllocationMobileSortDirection;
};

export const ALLOCATION_MOBILE_SORT_OPTIONS: AllocationMobileSortOption[] = [
  { value: "totalValue:desc", label: "Maior valor", key: "totalValue", direction: "desc" },
  { value: "totalValue:asc", label: "Menor valor", key: "totalValue", direction: "asc" },
  { value: "profitPercentage:desc", label: "Melhor L/P", key: "profitPercentage", direction: "desc" },
  { value: "profitPercentage:asc", label: "Pior L/P", key: "profitPercentage", direction: "asc" },
  { value: "name:asc", label: "Ativo A–Z", key: "name", direction: "asc" },
];

export function parseAllocationMobileSort(value: string): Pick<AllocationMobileSortOption, "key" | "direction"> {
  const option = ALLOCATION_MOBILE_SORT_OPTIONS.find((item) => item.value === value);
  return option
    ? { key: option.key, direction: option.direction }
    : { key: "totalValue", direction: "desc" };
}
