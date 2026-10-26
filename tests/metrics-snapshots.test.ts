import { describe, expect, it } from "vitest";
import { captureMetricSnapshots } from "../src/core/metrics-snapshots.js";

describe("bounded Threads metric snapshots", () => {
  const published = "2026-10-20T08:00:00Z";

  it("stores one 24h reading and one 72h reading from the existing fetches", () => {
    const first = captureMetricSnapshots(undefined, { views: 11, likes: 0 }, published, "2026-10-21T09:00:00Z");
    expect(first).toHaveLength(1);
    expect(first[0]?.window).toBe("24h");
    const next = captureMetricSnapshots(first, { views: 23, likes: 2 }, published, "2026-10-23T09:00:00Z");
    expect(next).toHaveLength(2);
    expect(next[1]?.window).toBe("72h");
    expect(next[0]?.metrics.views).toBe(11);
    const later = captureMetricSnapshots(next, { views: 999 }, published, "2026-10-25T10:00:00Z");
    expect(later).toEqual(next);
  });

  it("does not backfill 24h or 72h data from a week-late lifetime sample", () => {
    expect(captureMetricSnapshots([], { views: 400 }, published, "2026-10-27T09:00:00Z")).toEqual([]);
  });

  it("rejects immature, malformed and negative-time observations", () => {
    expect(captureMetricSnapshots([], { views: 10 }, published, "2026-10-20T20:00:00Z")).toEqual([]);
    expect(captureMetricSnapshots([], { views: 10 }, published, "invalid")).toEqual([]);
    expect(captureMetricSnapshots([], { views: 10 }, published, "2026-10-19T09:00:00Z")).toEqual([]);
    expect(captureMetricSnapshots([], { views: Number.NaN }, published, "2026-10-21T09:00:00Z")).toEqual([]);
  });

  it("does not duplicate a window or lose the original immutable reading", () => {
    const original = captureMetricSnapshots([], { views: 1 }, published, "2026-10-21T08:30:00Z");
    const repeated = captureMetricSnapshots(original, { views: 100 }, published, "2026-10-21T11:00:00Z");
    expect(repeated).toEqual(original);
  });
});
