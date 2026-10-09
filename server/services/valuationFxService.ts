import { eq } from "drizzle-orm";
import { valuationSettings } from "../../drizzle/schema";
import { resolveValuationFxRate, type ValuationFxResolution } from "../../shared/valuationFxPolicy";
import { getDb } from "../db";

/** Resolve o câmbio que deve ser usado na avaliação consolidada de um usuário. */
export async function resolveValuationFxRateForUser(
  userId: number,
  marketRate: number,
): Promise<ValuationFxResolution> {
  const db = await getDb();
  if (!db) return resolveValuationFxRate(marketRate);

  const rows = await db
    .select({ usdBrlReference: valuationSettings.usdBrlReference })
    .from(valuationSettings)
    .where(eq(valuationSettings.userId, userId))
    .limit(1);

  const referenceRate = rows[0]?.usdBrlReference ? Number(rows[0].usdBrlReference) : null;
  return resolveValuationFxRate(marketRate, referenceRate);
}
