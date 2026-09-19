import { describe, expect, it } from "vitest";
import { contentHash, parseIssueBody, serializeJob, type ThreadsJob } from "../src/domain/job.js";

const base: ThreadsJob = {
  schema_version: 1,
  status: "READY",
  publish_at: "2026-09-19T15:00:00-03:00",
  action: "post",
  topic: "artificial-intelligence",
  language: "es",
  content: { text: "Un texto original para Threads.", topic_tag: "IA", reply_control: "everyone" },
  visual: { mode: "none" },
  strategy: { hook_style: "curiosity", goal: "conversation", sources: ["https://example.com/source"] },
  dry_run: true
};

describe("Threads job", () => {
  it("round-trips through issue body serialization", () => {
    const parsed = parseIssueBody(serializeJob(base));
    expect(parsed.content.text).toBe(base.content.text);
    expect(parsed.status).toBe("READY");
  });

  it("produces a deterministic semantic content hash", () => {
    const first = contentHash(base);
    const second = contentHash({ ...base, content: { ...base.content, text: "  Un texto original   para Threads. " } });
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("requires relation_id for a reply", () => {
    expect(() => parseIssueBody(serializeJob({ ...base, action: "reply" }))).toThrow();
  });
});
