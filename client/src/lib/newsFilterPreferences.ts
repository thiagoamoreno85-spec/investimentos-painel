export const NEWS_FILTER_PREFERENCES_KEY = "investimentos:news-filter-preferences:v1";

export type NewsFilterPreferences = {
  category: string;
  impact: string;
  onlyUnread: boolean;
  onlyMajorExposure: boolean;
  selectedTicker: string;
};

export const DEFAULT_NEWS_FILTER_PREFERENCES: NewsFilterPreferences = {
  category: "all",
  impact: "all",
  onlyUnread: false,
  onlyMajorExposure: false,
  selectedTicker: "all",
};

const VALID_CATEGORIES = new Set(["all", "brasil", "global", "cripto", "tech", "politica", "macro"]);
const VALID_IMPACTS = new Set(["all", "alto", "medio", "baixo"]);

export function parseNewsFilterPreferences(value: string | null): NewsFilterPreferences {
  if (!value) return DEFAULT_NEWS_FILTER_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return DEFAULT_NEWS_FILTER_PREFERENCES;
    const candidate = parsed as Partial<NewsFilterPreferences>;
    return {
      category: typeof candidate.category === "string" && VALID_CATEGORIES.has(candidate.category) ? candidate.category : "all",
      impact: typeof candidate.impact === "string" && VALID_IMPACTS.has(candidate.impact) ? candidate.impact : "all",
      onlyUnread: candidate.onlyUnread === true,
      onlyMajorExposure: candidate.onlyMajorExposure === true,
      selectedTicker: typeof candidate.selectedTicker === "string" ? candidate.selectedTicker : "all",
    };
  } catch {
    return DEFAULT_NEWS_FILTER_PREFERENCES;
  }
}
