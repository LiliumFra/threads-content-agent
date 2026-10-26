export type SavedMetrics = Record<string, number | undefined>;
export interface StoredMetricSnapshot {
  window: "24h" | "72h";
  observed_at: string;
  age_hours: number;
  metrics: SavedMetrics;
}

/** Preserve one bounded measurement near 24h and 72h; never backfill from a later lifetime total. */
export function captureMetricSnapshots(
  prior: StoredMetricSnapshot[] | undefined,
  metrics: SavedMetrics,
  publishedAt: string,
  observedAt: string
): StoredMetricSnapshot[] {
  const existing = (prior ?? []).slice(0, 2);
  const start = Date.parse(publishedAt);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(start) || !Number.isFinite(observed) || observed < start) return existing;
  const age = (observed - start) / 3_600_000;
  const window: StoredMetricSnapshot["window"] | null =
    age >= 24 && age < 48 ? "24h" : age >= 72 && age < 96 ? "72h" : null;
  if (!window || existing.some(s => s.window === window)) return existing;
  if (!Object.values(metrics).some(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) return existing;
  const next: StoredMetricSnapshot = { window, observed_at: observedAt, age_hours: age, metrics: { ...metrics } };
  return [...existing, next]
    .sort((a, b) => a.window.localeCompare(b.window))
    .slice(0, 2);
}
