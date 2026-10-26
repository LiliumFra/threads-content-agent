import { describe, expect, it } from "vitest";
import {
  isMatureProviderSent,
  matchedLearningSegment,
  matchedLearningSegments,
  observationBand,
  segmentKey,
  type MetricsLearningJob
} from "../src/core/metrics-learning.js";

const now = Date.parse("2026-10-25T18:00:00Z");
function post({
  id = 1,
  provider = "sent",
  status = "PUBLISHED",
  language = "es",
  visual = "card",
  topic = "artificial-intelligence",
  type = "explainer",
  age = 30,
  published = "2026-10-23T12:00:00Z"
}: {
  id?: number; provider?: string; status?: string; language?: string;
  visual?: string; topic?: string; type?: string; age?: number; published?: string;
} = {}): MetricsLearningJob {
  const measuredAt = new Date(Date.parse(published) + age * 3_600_000).toISOString();
  return {
    status,
    language,
    topic,
    visual: { mode: visual },
    strategy: { content_type: type },
    result: {
      provider_status: provider,
      provider_post_id: String(id),
      published_at: published,
      metrics_updated_at: measuredAt,
      metrics: { views: 24, replies: 0, likes: 0 }
    }
  };
}

describe("metrics learning gates", () => {
  it("only accepts provider sent with a confirmed ID and a 24h+ observation", () => {
    expect(isMatureProviderSent(post(), now)).toBe(true);
    expect(isMatureProviderSent(post({ provider: "sending" }), now)).toBe(false);
    expect(isMatureProviderSent(post({ status: "DELIVERY_PENDING" }), now)).toBe(false);
    expect(isMatureProviderSent(post({ age: 12 }), now)).toBe(false);
    expect(isMatureProviderSent({ ...post(), result: { ...post().result, provider_post_id: "" } }, now)).toBe(false);
    const withoutTimestamp = post();
    if (withoutTimestamp.result) delete withoutTimestamp.result.metrics_updated_at;
    expect(isMatureProviderSent(withoutTimestamp, now)).toBe(false);
  });
  it("rejects observations created in the future", () => {
    expect(isMatureProviderSent(post({ published: "2026-10-25T08:00:00Z", age: 30 }), now)).toBe(false);
  });
  it("retains genuine zero engagement and properly age-buckets observations", () => {
    expect(isMatureProviderSent(post(), now)).toBe(true);
    expect(observationBand(post({ age: 24 }))).toBe("24-48h");
    expect(observationBand(post({ age: 48 }))).toBe("48-96h");
    expect(observationBand(post({ age: 96 }))).toBe("96h+");
    expect(observationBand(post({ age: 23 }))).toBe(null);
  });
  it("requires at least 20 in each comparable time period, not a global 20", () => {
    const es = Array.from({ length: 20 }, (_, i) => post({ id: i + 1 }));
    const en = Array.from({ length: 20 }, (_, i) => post({ id: 100 + i, language: "en" }));
    expect(matchedLearningSegment([...es, ...en])).toBeNull();
    expect(matchedLearningSegment([...es, ...en], 5)).toBeNull();
  });
  it("rejects cross-format and cross-observation-age comparisons", () => {
    const base = Array.from({ length: 19 }, (_, i) => post({ id: i }));
    expect(matchedLearningSegment([...base, ...Array.from({ length: 20 }, (_, i) => post({ id: 100 + i, visual: "none" }))])).toBeNull();
    expect(matchedLearningSegment([...base, ...Array.from({ length: 20 }, (_, i) => post({ id: 200 + i, age: 80 }))])).toBeNull();
    expect(segmentKey(post({ language: "en", visual: "none" }))).toBe("en|artificial-intelligence|explainer|none|24-48h");
  });
  it("does not confuse two different topics within the same language and format", () => {
    const oneTopic = Array.from({ length: 20 }, (_, id) => post({ id: 200 + id, topic: "android" }));
    const otherTopic = Array.from({ length: 20 }, (_, id) => post({ id: 300 + id, topic: "cybersecurity" }));
    expect(matchedLearningSegments([...oneTopic, ...otherTopic])).toHaveLength(0);
  });

  it("requires two separately replicated topic cohorts before account-wide tuning", () => {
    const android = Array.from({ length: 40 }, (_, id) => post({
      id: id + 1,
      topic: "android",
      published: new Date(Date.parse("2026-08-01T12:00:00Z") + id * 86_400_000).toISOString()
    }));
    const security = Array.from({ length: 40 }, (_, id) => post({
      id: id + 101,
      topic: "cybersecurity",
      published: new Date(Date.parse("2026-08-01T12:00:00Z") + id * 86_400_000).toISOString()
    }));
    const matched = matchedLearningSegments([...android, ...security]);
    expect(matched).toHaveLength(2);
    expect(matched.map(item => item.key)).toEqual(expect.arrayContaining([
      "es|android|explainer|card|24-48h",
      "es|cybersecurity|explainer|card|24-48h"
    ]));
  });

  it("selects 20+20 separate historical and recent snapshots of the same cohort", () => {
    const posts = Array.from({ length: 40 }, (_, i) => {
      const published = new Date(Date.parse("2026-08-01T12:00:00Z") + i * 86_400_000).toISOString();
      return post({ id: i + 1, published });
    });
    const matched = matchedLearningSegment(posts);
    expect(matched?.key).toBe("es|artificial-intelligence|explainer|card|24-48h");
    expect(matched?.baseline).toHaveLength(20);
    expect(matched?.recent).toHaveLength(20);
    expect(matched?.baseline[0]?.result?.provider_post_id).toBe("1");
    expect(matched?.recent[0]?.result?.provider_post_id).toBe("21");
  });
});
