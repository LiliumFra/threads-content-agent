import { describe, expect, it } from "vitest";
import { evaluatePolicy, type Policy } from "../src/core/policy.js";
import { contentHash, type ThreadsJob } from "../src/domain/job.js";

const policy: Policy = {
  timezone: "America/Argentina/Jujuy",
  max_posts_per_day: 5,
  min_interval_minutes: 75,
  topic_cooldown_hours: 18,
  native_topic_cooldown_hours: 3,
  max_same_native_topic_per_day: 2,
  duplicate_lookback: 100,
  metrics_refresh_hours: 24
};

function job(text = "contenido fresco", topic = "ai", topicTag = "InteligenciaArtificial"): ThreadsJob {
  return {
    schema_version: 1,
    status: "READY",
    publish_at: "2026-09-19T15:00:00-03:00",
    action: "post",
    topic,
    language: "es",
    content: { text, topic_tag: topicTag, reply_control: "everyone" },
    visual: { mode: "none" },
    strategy: {
      hook_style: "curiosity",
      goal: "conversation",
      content_type: "discussion",
      candidate_score: 80,
      sources: ["https://example.com"]
    },
    dry_run: true
  };
}

function published(input: ThreadsJob, at: string): ThreadsJob {
  return {
    ...input,
    status: "PUBLISHED",
    result: {
      status: "PUBLISHED",
      published_at: at,
      content_hash: contentHash(input),
      thread_id: "id-" + input.content.text
    }
  };
}

describe("policy", () => {
  it("blocks duplicate hashes", () => {
    const candidate = job("igual");
    const previous = published(candidate, "2026-09-18T12:00:00-03:00");
    const decision = evaluatePolicy(candidate, [previous], policy, new Date("2026-09-19T15:00:00-03:00"));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.retryable).toBe(false);
  });

  it("allows a fresh unrelated job", () => {
    expect(evaluatePolicy(job(), [], policy, new Date("2026-09-19T15:00:00-03:00")).ok).toBe(true);
  });

  it("blocks reuse of the same native Threads topic inside cooldown", () => {
    const previous = published(
      job("previo", "previous-ai", "InteligenciaArtificial"),
      "2026-09-19T13:30:00-03:00"
    );
    const candidate = job("nuevo", "new-ai", "InteligenciaArtificial");
    const decision = evaluatePolicy(
      candidate,
      [previous],
      { ...policy, min_interval_minutes: 0 },
      new Date("2026-09-19T15:00:00-03:00")
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("Native Threads topic cooldown");
  });

  it("caps the same native Threads topic twice per day", () => {
    const first = published(
      job("primero", "ai-one", "InteligenciaArtificial"),
      "2026-09-19T08:00:00-03:00"
    );
    const second = published(
      job("segundo", "ai-two", "InteligenciaArtificial"),
      "2026-09-19T12:00:00-03:00"
    );
    const candidate = job("tercero", "ai-three", "InteligenciaArtificial");
    const decision = evaluatePolicy(
      candidate,
      [second, first],
      { ...policy, min_interval_minutes: 0, native_topic_cooldown_hours: 0 },
      new Date("2026-09-19T17:00:00-03:00")
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("daily cap");
  });
  it("blocks the same newsroom event across languages even with different copy", () => {
    const original = job("One UI 9 starts rolling out", "android");
    original.language = "en";
    original.strategy.event_key = "samsung-one-ui-9-2026-10-10-rollout";
    const next = job("Samsung: nuevos equipos compatibles con One UI 9", "software");
    next.strategy.event_key = original.strategy.event_key;
    const decision = evaluatePolicy(
      next,
      [published(original, "2026-09-18T12:00:00-03:00")],
      { ...policy, min_interval_minutes: 0, topic_cooldown_hours: 0 },
      new Date("2026-09-19T15:00:00-03:00")
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.retryable).toBe(false);
      expect(decision.reason).toContain("Duplicate verified news event");
    }
  });

  it("uses newest results for lookback even if input history is oldest-first", () => {
    const old = published(job("old event", "old-topic"), "2026-09-01T08:00:00-03:00");
    const fresh = published(job("fresh event", "different-topic"), "2026-09-18T08:00:00-03:00");
    const next = job("old event", "old-topic");
    const decision = evaluatePolicy(
      next, [old, fresh],
      { ...policy, duplicate_lookback: 1, min_interval_minutes: 0, topic_cooldown_hours: 0 },
      new Date("2026-09-19T15:00:00-03:00")
    );
    expect(decision.ok).toBe(true);
  });

});
