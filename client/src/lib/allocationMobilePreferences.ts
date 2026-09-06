import { ALLOCATION_MOBILE_SORT_OPTIONS } from "@shared/allocationMobileControls";

export const ALLOCATION_MOBILE_SORT_PREFERENCE_KEY = "investimentos:allocation-mobile-sort:v1";
export const DEFAULT_ALLOCATION_MOBILE_SORT = "totalValue:desc";

export function parseAllocationMobileSortPreference(value: string | null): string {
  return ALLOCATION_MOBILE_SORT_OPTIONS.some((option) => option.value === value)
    ? value!
    : DEFAULT_ALLOCATION_MOBILE_SORT;
}
