import { describe, expect, it } from "vitest";
import { evaluatePolicy, type Policy } from "../src/core/policy.js";
import { contentHash, type ThreadsJob } from "../src/domain/job.js";

const policy: Policy = {
  timezone: "America/Argentina/Jujuy",
  max_posts_per_day: 5,
  min_interval_minutes: 75,
  topic_cooldown_hours: 18,
  duplicate_lookback: 100,
  metrics_refresh_hours: 6
};

function job(text = "contenido fresco", topic = "ai"): ThreadsJob {
  return {
    schema_version: 1,
    status: "READY",
    publish_at: "2026-09-19T15:00:00-03:00",
    action: "post",
    topic,
    language: "es",
    content: { text, reply_control: "everyone" },
    visual: { mode: "none" },
    strategy: { hook_style: "curiosity", goal: "conversation", sources: ["https://example.com"] },
    dry_run: true
  };
}

describe("policy", () => {
  it("blocks duplicate hashes", () => {
    const candidate = job("igual");
    const previous: ThreadsJob = {
      ...candidate,
      status: "PUBLISHED",
      result: {
        status: "PUBLISHED",
        published_at: "2026-09-18T12:00:00-03:00",
        content_hash: contentHash(candidate),
        thread_id: "1"
      }
    };
    const decision = evaluatePolicy(candidate, [previous], policy, new Date("2026-09-19T15:00:00-03:00"));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.retryable).toBe(false);
  });

  it("allows a fresh unrelated job", () => {
    expect(evaluatePolicy(job(), [], policy, new Date("2026-09-19T15:00:00-03:00")).ok).toBe(true);
  });
});
