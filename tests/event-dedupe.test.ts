import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileProcessor } from "../src/core/file-processor.js";
import type { ThreadsJob } from "../src/domain/job.js";
import type { Policy } from "../src/core/policy.js";

const policy: Policy = {
  timezone: "America/Argentina/Jujuy",
  max_posts_per_day: 16,
  min_interval_minutes: 60,
  topic_cooldown_hours: 18,
  native_topic_cooldown_hours: 2,
  max_same_native_topic_per_day: 2,
  duplicate_lookback: 100,
  metrics_refresh_hours: 24
};
const tempDirs: string[] = [];
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

function job(language: string): ThreadsJob {
  return {
    schema_version: 1,
    status: "READY",
    publish_at: "2026-10-25T09:00:00-03:00",
    action: "post",
    topic: "android",
    language,
    content: { text: language === "en" ? "Same launch, English angle" : "El mismo lanzamiento, otro título", topic_tag: "Android" },
    visual: { mode: "none" },
    strategy: {
      event_key: "samsung-one-ui-9-2026-10-25-rollout",
      hook_style: "user-utility",
      goal: "inform",
      content_type: "explainer",
      candidate_score: 80,
      sources: ["https://example.org/source", "https://example.net/report"]
    },
    dry_run: true
  };
}

describe("queue cross-status event dedupe", () => {
  it("moves a repeated failed event to REVIEW without calling the provider", async () => {
    const root = await mkdtemp(join(tmpdir(), "threads-event-"));
    tempDirs.push(root);
    const pendingDir = join(root, "pending");
    const resultsDir = join(root, "results");
    await Promise.all([mkdir(pendingDir), mkdir(resultsDir)]);
    const prior = job("en");
    prior.status = "FAILED";
    prior.result = { status: "FAILED", content_hash: "a".repeat(64), error: "media failed" };
    await writeFile(join(resultsDir, "original.json"), JSON.stringify(prior));

    const candidatePath = join(pendingDir, "new-copy.json");
    await writeFile(candidatePath, JSON.stringify(job("es")));
    const processor = new FileProcessor({ policy, pendingDir, resultsDir });
    const outcome = await processor.processFile(candidatePath, new Date("2026-10-25T12:05:00Z"));
    expect(outcome).toBe("review:duplicate-news-event");
    const recorded = JSON.parse(await readFile(join(resultsDir, "new-copy.json"), "utf8"));
    expect(recorded.status).toBe("REVIEW");
    expect(recorded.result.status).toBe("REVIEW");
    expect(recorded.result.provider_post_id).toBeUndefined();
    await expect(readFile(candidatePath, "utf8")).rejects.toThrow();
  });

  it("does not infer that an unreadable duplicate ledger makes publishing safe", async () => {
    const root = await mkdtemp(join(tmpdir(), "threads-event-"));
    tempDirs.push(root);
    const pendingDir = join(root, "pending");
    const resultsDir = join(root, "results");
    await Promise.all([mkdir(pendingDir), mkdir(resultsDir)]);
    await writeFile(join(resultsDir, "corrupt.json"), "{not-json");
    const candidatePath = join(pendingDir, "new-copy.json");
    await writeFile(candidatePath, JSON.stringify(job("es")));
    const processor = new FileProcessor({ policy, pendingDir, resultsDir });
    const outcome = await processor.processFile(candidatePath, new Date("2026-10-25T12:05:00Z"));
    expect(outcome).toBe("queued:event-history-unverifiable");
    const original = JSON.parse(await readFile(candidatePath, "utf8"));
    expect(original.status).toBe("READY");
  });
});
