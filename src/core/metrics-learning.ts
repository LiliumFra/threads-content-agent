/** Read-only, provider-grounded eligibility and matched-segment selection for adaptive learning. */
export interface MetricsLearningJob {
  status?: string;
  language?: string;
  visual?: { mode?: string };
  strategy?: { content_type?: string };
  result?: {
    provider_status?: string;
    provider_post_id?: string;
    published_at?: string;
    metrics_updated_at?: string;
    metrics?: Record<string, number | undefined>;
  };
}

export function observedAgeHours(job: MetricsLearningJob): number | null {
  const result = job.result;
  if (!result?.published_at || !result.metrics_updated_at) return null;
  const start = Date.parse(result.published_at);
  const measured = Date.parse(result.metrics_updated_at);
  if (!Number.isFinite(start) || !Number.isFinite(measured) || measured < start) return null;
  return (measured - start) / 3_600_000;
}

/** Snapshot age bands reduce, but cannot eliminate, the bias from comparing lifetime view counts. */
export function observationBand(job: MetricsLearningJob): string | null {
  const age = observedAgeHours(job);
  if (age === null || age < 24) return null;
  if (age < 48) return "24-48h";
  if (age < 96) return "48-96h";
  return "96h+";
}

export function isMatureProviderSent(job: MetricsLearningJob, nowMs: number, minHours = 24): boolean {
  const result = job.result;
  if (job.status !== "PUBLISHED" || result?.provider_status !== "sent" ||
      !result.provider_post_id?.trim() || !result.published_at ||
      !result.metrics_updated_at || !result.metrics) return false;
  const start = Date.parse(result.published_at);
  const measured = Date.parse(result.metrics_updated_at);
  if (!Number.isFinite(start) || !Number.isFinite(measured)) return false;
  if (start > nowMs || measured > nowMs || measured < start) return false;
  if (nowMs - start < minHours * 3_600_000 || measured - start < minHours * 3_600_000) return false;
  return Object.values(result.metrics).some(v => typeof v === "number" && Number.isFinite(v) && v >= 0);
}

/** Deliberately conservative: prevent global, cross-language or cross-format auto-tuning. */
export function segmentKey(job: MetricsLearningJob): string | null {
  const band = observationBand(job);
  if (!band) return null;
  return [job.language || "unknown", job.strategy?.content_type || "unknown", job.visual?.mode || "unknown", band].join("|");
}

export function matchedLearningSegment<T extends MetricsLearningJob>(
  matureJobs: T[], minimumPerPeriod = 20
): { key: string; baseline: T[]; recent: T[]; sample: number } | null {
  const min = Math.max(20, Math.ceil(minimumPerPeriod));
  const groups = new Map<string, T[]>();
  for (const job of matureJobs) {
    const key = segmentKey(job);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(job);
    groups.set(key, bucket);
  }
  const eligible = [...groups.entries()]
    .filter(([, entries]) => entries.length >= 2 * min)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (!eligible.length) return null;
  const [key, entries] = eligible[0]!;
  const ordered = [...entries].sort((a, b) =>
    Date.parse(a.result?.published_at ?? "") - Date.parse(b.result?.published_at ?? ""));
  return {
    key,
    baseline: ordered.slice(-2 * min, -min),
    recent: ordered.slice(-min),
    sample: ordered.length
  };
}
