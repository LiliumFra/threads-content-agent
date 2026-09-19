import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AmbiguousPublishError,
  ThreadsProvider
} from "../src/threads/provider.js";
import type { ThreadsJob } from "../src/domain/job.js";

const baseJob: ThreadsJob = {
  schema_version: 1,
  status: "READY",
  publish_at: "2026-09-19T00:00:00-03:00",
  action: "post",
  topic: "ai",
  language: "es",
  content: {
    text: "Prueba",
    reply_control: "everyone"
  },
  visual: {
    mode: "card",
    headline: "Titular",
    subheadline: "Contexto",
    eyebrow: "TECNOLOGÍA",
    alt_text: "Descripción accesible"
  },
  strategy: {
    hook_style: "curiosity",
    goal: "conversation",
    sources: ["https://example.com"]
  },
  dry_run: false
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThreadsProvider", () => {
  it("waits for an image container to finish before publishing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1", status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "thread-1" }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const provider = new ThreadsProvider("token");
    const id = await provider.publish(baseJob, "https://example.com/image.png");

    expect(id).toBe("thread-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("fields=id,status,error_message");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("threads_publish");
  });

  it("marks an ambiguous publish instead of blindly retrying a published container", async () => {
    const textJob: ThreadsJob = {
      ...baseJob,
      visual: { mode: "none" }
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-2", status: "PUBLISHED" }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const provider = new ThreadsProvider("token");
    await expect(provider.publish(textJob)).rejects.toBeInstanceOf(AmbiguousPublishError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reads the official publishing quota", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{
          quota_usage: 3,
          config: { quota_total: 250, quota_duration: 86400 },
          reply_quota_usage: 4,
          reply_config: { quota_total: 1000, quota_duration: 86400 }
        }]
      }), { status: 200 })
    ));

    const quota = await new ThreadsProvider("token").getPublishingQuota();
    expect(quota.postUsage).toBe(3);
    expect(quota.postTotal).toBe(250);
    expect(quota.replyTotal).toBe(1000);
  });
});
