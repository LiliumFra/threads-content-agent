import { describe, expect, it } from "vitest";
import { countDailyMediaUploads } from "../src/core/file-processor.js";
import { type ThreadsJob } from "../src/domain/job.js";

const today = new Date("2026-10-19T23:00:00-03:00");
const timezone = "America/Argentina/Jujuy";
const cardUrl = "https://res.cloudinary.com/example/image/upload/card.jpg";
const extraUrl = "https://res.cloudinary.com/example/image/upload/extra.jpg";

function recorded(
  status: "PUBLISHED" | "FAILED" | "REVIEW",
  submittedAt: string | undefined,
  mediaUrls: string[]
): ThreadsJob {
  return {
    schema_version: 1,
    status,
    publish_at: "2026-10-19T10:00:00-03:00",
    action: "post",
    topic: "artificial-intelligence",
    language: "es",
    content: { text: "Noticia original", topic_tag: "IA" },
    visual: { mode: "none" },
    strategy: { hook_style: "news", goal: "inform", sources: ["https://example.org"] },
    dry_run: false,
    result: {
      status,
      content_hash: "a".repeat(64),
      ...(submittedAt ? { submitted_at: submittedAt } : {}),
      media_urls: mediaUrls
    }
  };
}

describe("Cloudinary daily upload accounting", () => {
  it("counts an uploaded card even if Buffer later fails delivery", () => {
    const failed = recorded("FAILED", "2026-10-19T14:00:00Z", [cardUrl]);
    expect(countDailyMediaUploads([failed], today, timezone)).toBe(1);
  });

  it("deduplicates a reused card URL but includes an additional source asset", () => {
    const failed = recorded("FAILED", "2026-10-19T14:00:00Z", [cardUrl]);
    const retried = recorded("PUBLISHED", "2026-10-19T14:20:00Z", [cardUrl, extraUrl]);
    expect(countDailyMediaUploads([failed, retried], today, timezone)).toBe(2);
  });

  it("does not count uploaded images from the prior policy day", () => {
    const previous = recorded("PUBLISHED", "2026-10-19T02:00:00Z", [cardUrl]);
    const current = recorded("REVIEW", "2026-10-20T02:00:00Z", [extraUrl]);
    expect(countDailyMediaUploads([previous, current], today, timezone)).toBe(1);
  });

  it("fails closed when an uploaded image has no trustworthy timestamp", () => {
    expect(() => countDailyMediaUploads([recorded("FAILED", undefined, [cardUrl])], today, timezone)).toThrow(
      /unknown timestamp/
    );
  });
});
