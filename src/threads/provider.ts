import type { ThreadsJob, ThreadsMetrics } from "../domain/job.js";

type IdResponse = { id?: string };
type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
type ContainerStatusResponse = {
  id?: string;
  status?: ContainerStatus;
  error_message?: string;
};
type InsightResponse = {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
  }>;
};
type QuotaResponse = {
  data?: Array<{
    quota_usage?: number;
    config?: { quota_total?: number; quota_duration?: number };
    reply_quota_usage?: number;
    reply_config?: { quota_total?: number; quota_duration?: number };
  }>;
};

export type PublishingQuota = {
  postUsage: number;
  postTotal: number;
  postWindowSeconds: number;
  replyUsage: number;
  replyTotal: number;
  replyWindowSeconds: number;
};

export class RetryableThreadsError extends Error {
  override readonly name = "RetryableThreadsError";
}

export class AmbiguousPublishError extends Error {
  override readonly name = "AmbiguousPublishError";
}

async function errorDetail(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function describeUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ThreadsProvider {
  constructor(
    private readonly accessToken: string,
    private readonly apiHost = "https://graph.threads.net"
  ) {}

  private headers(): HeadersInit {
    return {
      Accept: "application/json",
      Authorization: "Bearer " + this.accessToken
    };
  }

  private async getContainerStatus(containerId: string): Promise<ContainerStatusResponse> {
    let response: Response;
    try {
      response = await fetch(
        this.apiHost + "/" + encodeURIComponent(containerId) + "?fields=id,status,error_message",
        { headers: this.headers() }
      );
    } catch (error) {
      throw new RetryableThreadsError("Could not read Threads container status: " + describeUnknown(error));
    }

    if (!response.ok) {
      const detail = await errorDetail(response);
      if (isRetryableStatus(response.status)) {
        throw new RetryableThreadsError("Threads status check temporarily failed: " + response.status + " " + detail);
      }
      throw new Error("Threads status check failed: " + response.status + " " + detail);
    }

    return await response.json() as ContainerStatusResponse;
  }

  private async safeContainerStatus(containerId: string): Promise<ContainerStatusResponse | undefined> {
    try {
      return await this.getContainerStatus(containerId);
    } catch {
      return undefined;
    }
  }

  private async waitUntilPublishable(
    containerId: string,
    timeoutMs = 60_000,
    intervalMs = 2_000
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const state = await this.getContainerStatus(containerId);

      if (state.status === "FINISHED" || state.status === "PUBLISHED") return;
      if (state.status === "ERROR" || state.status === "EXPIRED") {
        throw new Error(
          "Threads container " + state.status + (state.error_message ? ": " + state.error_message : "")
        );
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new RetryableThreadsError("Threads media container did not become publishable before timeout");
  }

  async getPublishingQuota(): Promise<PublishingQuota> {
    const fields = "quota_usage,config,reply_quota_usage,reply_config";
    let response: Response;
    try {
      response = await fetch(
        this.apiHost + "/me/threads_publishing_limit?fields=" + encodeURIComponent(fields),
        { headers: this.headers() }
      );
    } catch (error) {
      throw new RetryableThreadsError("Could not read Threads publishing quota: " + describeUnknown(error));
    }

    if (!response.ok) {
      const detail = await errorDetail(response);
      if (isRetryableStatus(response.status)) {
        throw new RetryableThreadsError("Threads quota check temporarily failed: " + response.status + " " + detail);
      }
      throw new Error("Threads quota check failed: " + response.status + " " + detail);
    }

    const payload = await response.json() as QuotaResponse;
    const item = payload.data?.[0];
    if (!item?.config?.quota_total || !item.reply_config?.quota_total) {
      throw new RetryableThreadsError("Threads quota response was incomplete");
    }

    return {
      postUsage: item.quota_usage ?? 0,
      postTotal: item.config.quota_total,
      postWindowSeconds: item.config.quota_duration ?? 86_400,
      replyUsage: item.reply_quota_usage ?? 0,
      replyTotal: item.reply_config.quota_total,
      replyWindowSeconds: item.reply_config.quota_duration ?? 86_400
    };
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

    let createResponse: Response;
    try {
      createResponse = await fetch(
        this.apiHost + "/me/threads?" + params.toString(),
        { method: "POST", headers: this.headers() }
      );
    } catch (error) {
      throw new RetryableThreadsError("Threads container creation network failure: " + describeUnknown(error));
    }

    if (!createResponse.ok) {
      const detail = await errorDetail(createResponse);
      if (isRetryableStatus(createResponse.status)) {
        throw new RetryableThreadsError(
          "Threads container creation temporarily failed: " + createResponse.status + " " + detail
        );
      }
      throw new Error(
        "Threads container creation failed: " + createResponse.status + " " + detail
      );
    }

    const created = await createResponse.json() as IdResponse;
    if (!created.id) throw new Error("Threads container response did not contain id");

    if (imageUrl) {
      await this.waitUntilPublishable(created.id);
    }

    let lastError = "unknown publish failure";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const publishParams = new URLSearchParams({ creation_id: created.id });
      let publishResponse: Response;

      try {
        publishResponse = await fetch(
          this.apiHost + "/me/threads_publish?" + publishParams.toString(),
          { method: "POST", headers: this.headers() }
        );
      } catch (error) {
        const state = await this.safeContainerStatus(created.id);
        if (state?.status === "PUBLISHED") {
          throw new AmbiguousPublishError(
            "Threads reports the container as PUBLISHED after a network failure, but the published media ID was not received"
          );
        }
        if (state?.status === "FINISHED" && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2_500));
          continue;
        }
        throw new AmbiguousPublishError(
          "Network failure during threads_publish; publication state cannot be proven safely: " + describeUnknown(error)
        );
      }

      if (publishResponse.ok) {
        const published = await publishResponse.json() as IdResponse;
        if (!published.id) {
          throw new AmbiguousPublishError("Threads publish succeeded without returning a media id");
        }
        return published.id;
      }

      lastError = publishResponse.status + " " + await errorDetail(publishResponse);
      const state = await this.safeContainerStatus(created.id);

      if (state?.status === "PUBLISHED") {
        throw new AmbiguousPublishError(
          "Threads reports the container as PUBLISHED after an API error, but no published media ID was received"
        );
      }

      if (state?.status === "ERROR" || state?.status === "EXPIRED") {
        throw new Error(
          "Threads container " + state.status + (state.error_message ? ": " + state.error_message : "")
        );
      }

      if (isRetryableStatus(publishResponse.status) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_500));
        continue;
      }

      if (!isRetryableStatus(publishResponse.status)) {
        throw new Error("Threads publish failed: " + lastError);
      }
    }

    throw new RetryableThreadsError("Threads publish remained unavailable after retries: " + lastError);
  }

  async getInsights(threadId: string): Promise<ThreadsMetrics> {
    const metrics = "views,likes,replies,reposts,quotes";
    const response = await fetch(
      this.apiHost + "/" + encodeURIComponent(threadId) + "/insights?metric=" + encodeURIComponent(metrics),
      { headers: this.headers() }
    );

    if (!response.ok) {
      throw new Error("Threads insights failed: " + response.status + " " + await errorDetail(response));
    }

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
