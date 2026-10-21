export type DeclaredReturnBaseline = {
  effectiveDate: string;
  returnValueBRL: number;
  notes?: string | null;
};

export type OfficialReturnPoint = {
  date: string;
  returnValueBRL: number;
};

/**
 * Combina uma base de retorno declarada pelo investidor com fechamentos oficiais
 * estritamente posteriores à sua data-base. O próprio dia-base é excluído para
 * evitar dupla contagem de uma estimativa intradiária já absorvida no valor declarado.
 */
export function combineDeclaredReturnBaseline(
  baseline: DeclaredReturnBaseline,
  officialPoints: OfficialReturnPoint[],
) {
  const included = officialPoints
    .filter((point) => point.date > baseline.effectiveDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  const officialReturnSinceBRL = included.reduce((sum, point) => sum + point.returnValueBRL, 0);

  return {
    effectiveDate: baseline.effectiveDate,
    declaredReturnBRL: baseline.returnValueBRL,
    officialReturnSinceBRL,
    totalReturnBRL: baseline.returnValueBRL + officialReturnSinceBRL,
    officialCloseCountSince: included.length,
    firstOfficialCloseAfterBaseline: included[0]?.date ?? null,
    lastOfficialCloseAfterBaseline: included.at(-1)?.date ?? null,
    notes: baseline.notes ?? null,
  };
}
