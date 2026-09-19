import { afterEach, describe, expect, it, vi } from "vitest";
import { BufferConfigurationError, BufferProvider } from "../src/buffer/provider.js";
import type { ThreadsJob } from "../src/domain/job.js";

const baseJob: ThreadsJob = {
  schema_version: 1,
  status: "READY",
  publish_at: "2026-09-19T00:00:00-03:00",
  action: "post",
  topic: "ai",
  language: "es",
  content: { text: "Prueba Buffer" },
  visual: {
    mode: "card",
    headline: "Titular",
    subheadline: "Contexto",
    eyebrow: "TECNOLOGÍA",
    alt_text: "Texto alternativo"
  },
  strategy: {
    hook_style: "curiosity",
    goal: "conversation",
    sources: ["https://example.com"]
  },
  dry_run: false
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BufferProvider", () => {
  it("discovers one Threads channel and publishes an image with alt text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        data: { account: { organizations: [{ id: "org-1", name: "Org" }] } }
      }))
      .mockResolvedValueOnce(json({
        data: {
          channels: [{
            id: "thread-channel",
            name: "My Threads",
            displayName: "@example",
            service: "threads",
            isDisconnected: false,
            isLocked: false
          }]
        }
      }))
      .mockResolvedValueOnce(json({
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: {
              id: "buffer-post-1",
              status: "sent",
              externalLink: "https://www.threads.net/@example/post/abc"
            }
          }
        }
      }));

    vi.stubGlobal("fetch", fetchMock);

    const provider = new BufferProvider("secret");
    const result = await provider.publish(baseJob, "https://cdn.example.com/card.png");

    expect(result.id).toBe("buffer-post-1");
    expect(result.externalUrl).toContain("threads.net");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const createCall = fetchMock.mock.calls[2];
    const init = createCall?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      variables: { input: { channelId: string; mode: string; assets: unknown[] } };
    };
    expect(body.variables.input.channelId).toBe("thread-channel");
    expect(body.variables.input.mode).toBe("shareNow");
    expect(JSON.stringify(body.variables.input.assets)).toContain("Texto alternativo");
  });

  it("requires BUFFER_CHANNEL_ID when multiple active Threads channels exist", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        data: { account: { organizations: [{ id: "org-1" }] } }
      }))
      .mockResolvedValueOnce(json({
        data: {
          channels: [
            { id: "a", service: "threads", isDisconnected: false, isLocked: false },
            { id: "b", service: "threads", isDisconnected: false, isLocked: false }
          ]
        }
      }));

    vi.stubGlobal("fetch", fetchMock);
    await expect(new BufferProvider("secret").healthCheck())
      .rejects.toBeInstanceOf(BufferConfigurationError);
  });

  it("maps Buffer metrics to normalized Threads metrics and preserves raw values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      data: {
        post: {
          id: "buffer-post-1",
          metrics: [
            { type: "views", value: 100 },
            { type: "reactions", value: 9 },
            { type: "comments", value: 4 },
            { type: "reposts", value: 2 }
          ],
          metricsUpdatedAt: "2026-09-19T08:00:00Z"
        }
      }
    })));

    const snapshot = await new BufferProvider("secret").getMetrics("buffer-post-1");
    expect(snapshot.normalized.views).toBe(100);
    expect(snapshot.normalized.likes).toBe(9);
    expect(snapshot.normalized.replies).toBe(4);
    expect(snapshot.normalized.reposts).toBe(2);
    expect(snapshot.raw.reactions).toBe(9);
  });
});
