import type { ThreadsJob, ThreadsMetrics } from "../domain/job.js";

type IdResponse = { id?: string };
type InsightResponse = { data?: Array<{ name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }> };

async function errorDetail(response: Response): Promise<string> {
  try { return await response.text(); } catch { return response.statusText; }
}

export class ThreadsProvider {
  constructor(private readonly accessToken: string, private readonly apiHost = "https://graph.threads.net") {}

  private headers(): HeadersInit {
    return { Accept: "application/json", Authorization: "Bearer " + this.accessToken };
  }

  async publish(job: ThreadsJob, imageUrl?: string): Promise<string> {
    const params = new URLSearchParams();
    params.set("text", job.content.text);
    params.set("media_type", imageUrl ? "IMAGE" : "TEXT");
    if (imageUrl) {
      params.set("image_url", imageUrl);
      if (job.visual.mode === "card") params.set("alt_text", job.visual.alt_text);
    }
    if (job.content.topic_tag) params.set("topic_tag", job.content.topic_tag);
    if (job.content.reply_control) params.set("reply_control", job.content.reply_control);
    if (job.action === "reply" && job.relation_id) params.set("reply_to_id", job.relation_id);
    if (job.action === "quote" && job.relation_id) params.set("quote_post_id", job.relation_id);

    const createResponse = await fetch(this.apiHost + "/me/threads?" + params, { method: "POST", headers: this.headers() });
    if (!createResponse.ok) throw new Error("Threads container creation failed: " + createResponse.status + " " + await errorDetail(createResponse));
    const created = await createResponse.json() as IdResponse;
    if (!created.id) throw new Error("Threads container response did not contain id");

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const publishParams = new URLSearchParams({ creation_id: created.id });
      const response = await fetch(this.apiHost + "/me/threads_publish?" + publishParams, { method: "POST", headers: this.headers() });
      if (response.ok) {
        const published = await response.json() as IdResponse;
        if (!published.id) throw new Error("Threads publish response did not contain id");
        return published.id;
      }
      lastError = await errorDetail(response);
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    }
    throw new Error("Threads publish failed: " + lastError);
  }

  async getInsights(threadId: string): Promise<ThreadsMetrics> {
    const metrics = "views,likes,replies,reposts,quotes";
    const response = await fetch(this.apiHost + "/" + encodeURIComponent(threadId) + "/insights?metric=" + encodeURIComponent(metrics), {
      headers: this.headers()
    });
    if (!response.ok) throw new Error("Threads insights failed: " + response.status + " " + await errorDetail(response));

    const payload = await response.json() as InsightResponse;
    const result: ThreadsMetrics = {};
    for (const item of payload.data ?? []) {
      if (!item.name) continue;
      const value = item.values?.[0]?.value ?? item.total_value?.value;
      if (typeof value !== "number") continue;
      if (item.name === "views") result.views = value;
      if (item.name === "likes") result.likes = value;
      if (item.name === "replies") result.replies = value;
      if (item.name === "reposts") result.reposts = value;
      if (item.name === "quotes") result.quotes = value;
    }
    return result;
  }
}
