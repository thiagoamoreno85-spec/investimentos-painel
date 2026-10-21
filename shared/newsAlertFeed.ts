import { normalizeNewsIdentityPart } from "./newsIngestionPolicy";

export interface NewsAlertFeedItem {
  id: number;
  assetId: number;
  type: string;
  sourceNewsId?: number | null;
  sourceNewsTitle?: string | null;
  triggeredMessage?: string | null;
}

/**
 * Mantém um alerta por notícia e por ativo. A entrada deve estar ordenada do
 * mais recente ao mais antigo, para que o registro atual seja preservado.
 * Alertas manuais nunca são removidos desta visualização.
 */
export function selectDistinctAlertFeed<T extends NewsAlertFeedItem>(alerts: readonly T[]): T[] {
  const seenNewsAlerts = new Set<string>();

  return alerts.filter((alert) => {
    if (alert.type !== "news_alert") return true;

    const newsIdentity = alert.sourceNewsId
      ? `source:${alert.sourceNewsId}`
      : `legacy:${normalizeNewsIdentityPart(alert.sourceNewsTitle ?? alert.triggeredMessage)}`;
    const key = `${alert.assetId}:${newsIdentity}`;

    if (seenNewsAlerts.has(key)) return false;
    seenNewsAlerts.add(key);
    return true;
  });
}
