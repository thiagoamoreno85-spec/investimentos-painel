export type ManualPriceStatus = "sem_data" | "atual" | "atencao" | "desatualizado";

export type ManualPriceFreshness = {
  status: ManualPriceStatus;
  ageInDays: number | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Classifica a atualidade da referência informada para um preço manual. */
export function getManualPriceFreshness(
  referenceDate: Date | string | null | undefined,
  now: Date = new Date()
): ManualPriceFreshness {
  if (!referenceDate) return { status: "sem_data", ageInDays: null };

  const parsed = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(parsed.getTime())) return { status: "sem_data", ageInDays: null };

  const ageInDays = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / DAY_IN_MS));
  if (ageInDays > 30) return { status: "desatualizado", ageInDays };
  if (ageInDays > 14) return { status: "atencao", ageInDays };
  return { status: "atual", ageInDays };
}
