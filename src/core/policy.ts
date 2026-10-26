import { readFile } from "node:fs/promises";
import { z } from "zod";
import { contentHash, type ThreadsJob } from "../domain/job.js";

const policySchema = z.object({
  timezone: z.string().min(1),
  max_posts_per_day: z.number().int().positive(),
  min_interval_minutes: z.number().int().nonnegative(),
  topic_cooldown_hours: z.number().int().nonnegative(),
  native_topic_cooldown_hours: z.number().int().nonnegative(),
  max_same_native_topic_per_day: z.number().int().positive(),
  duplicate_lookback: z.number().int().positive().max(500),
  metrics_refresh_hours: z.number().int().positive()
});

export type Policy = z.infer<typeof policySchema>;

export async function loadPolicy(path = "config/policy.json"): Promise<Policy> {
  return policySchema.parse(JSON.parse(await readFile(path, "utf8")));
}

function dayKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [value.year, value.month, value.day].join("-");
}

function normalizeTopic(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ").toLowerCase();
  return normalized || undefined;
}

export type PolicyDecision =
  | { ok: true }
  | { ok: false; retryable: boolean; reason: string };

export function evaluatePolicy(candidate: ThreadsJob, published: ThreadsJob[], policy: Policy, now = new Date()): PolicyDecision {
  const hash = contentHash(candidate);
  // Filesystem result names are not guaranteed newest-first; use the most recent
  // delivery/submission evidence before applying the lookback.
  const recent = [...published]
    .sort((a, b) => Date.parse(b.result?.published_at ?? b.result?.submitted_at ?? "1970-01-01") -
      Date.parse(a.result?.published_at ?? a.result?.submitted_at ?? "1970-01-01"))
    .slice(0, policy.duplicate_lookback);
  if (recent.some((job) => job.result?.content_hash === hash)) {
    return { ok: false, retryable: false, reason: "Duplicate content hash" };
  }
  // A stable newsroom event ID must dedupe even when language, hook or card
  // differs. Keep this independent from the 18-hour category cooldown.
  const eventKey = candidate.strategy.event_key;
  if (eventKey && recent.some((job) => job.strategy.event_key === eventKey)) {
    return { ok: false, retryable: false, reason: "Duplicate verified news event" };
  }

  const withDates = published
    .filter((job) => job.result?.published_at)
    .map((job) => ({ job, date: new Date(job.result!.published_at!) }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const today = dayKey(now, policy.timezone);
  const publishedToday = withDates.filter((entry) => dayKey(entry.date, policy.timezone) === today);
  if (publishedToday.length >= policy.max_posts_per_day) {
    return { ok: false, retryable: true, reason: "Daily publication cap reached" };
  }

  const latest = withDates[0]?.date;
  if (latest && now.getTime() - latest.getTime() < policy.min_interval_minutes * 60_000) {
    return { ok: false, retryable: true, reason: "Minimum publication interval not reached" };
  }

  const nativeTopic = normalizeTopic(candidate.content.topic_tag);
  if (nativeTopic) {
    const sameNativeToday = publishedToday.filter(
      (entry) => normalizeTopic(entry.job.content.topic_tag) === nativeTopic
    );
    if (sameNativeToday.length >= policy.max_same_native_topic_per_day) {
      return { ok: false, retryable: true, reason: "Native Threads topic daily cap reached" };
    }

    const latestSameNative = withDates.find(
      (entry) => normalizeTopic(entry.job.content.topic_tag) === nativeTopic
    )?.date;
    if (
      latestSameNative &&
      now.getTime() - latestSameNative.getTime() < policy.native_topic_cooldown_hours * 3_600_000
    ) {
      return { ok: false, retryable: true, reason: "Native Threads topic cooldown is still active" };
    }
  }

  const latestSameTopic = withDates.find((entry) => entry.job.topic === candidate.topic)?.date;
  if (latestSameTopic && now.getTime() - latestSameTopic.getTime() < policy.topic_cooldown_hours * 3_600_000) {
    return { ok: false, retryable: true, reason: "Topic cooldown is still active" };
  }

  return { ok: true };
}
