export type ChronologicalNews = {
  publishedAt: Date | string | null;
  createdAt: Date | string;
  id?: number;
};

function timestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Ordena por publicação da fonte (mais recente primeiro). A data de inclusão
 * no painel só é usada quando a fonte não forneceu publicação ou em empates.
 */
export function sortNewsByPublicationDate<T extends ChronologicalNews>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPublished = timestamp(left.publishedAt) ?? timestamp(left.createdAt) ?? 0;
    const rightPublished = timestamp(right.publishedAt) ?? timestamp(right.createdAt) ?? 0;
    if (rightPublished !== leftPublished) return rightPublished - leftPublished;

    const leftCreated = timestamp(left.createdAt) ?? 0;
    const rightCreated = timestamp(right.createdAt) ?? 0;
    if (rightCreated !== leftCreated) return rightCreated - leftCreated;

    return (right.id ?? 0) - (left.id ?? 0);
  });
}
