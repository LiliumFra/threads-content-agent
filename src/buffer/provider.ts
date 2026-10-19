import type { ThreadsJob, ThreadsMetrics } from "../domain/job.js";
import { assessBufferBudget, readBufferRateWindows, type BufferRateWindow } from "../core/free-budget.js";

type GraphQLError = {
  message?: string;
  extensions?: { code?: string };
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
};

type Organization = {
  id: string;
  name?: string | null;
};

type Channel = {
  id: string;
  name?: string | null;
  displayName?: string | null;
  service?: string | null;
  isDisconnected?: boolean;
  isLocked?: boolean;
};

type CreatePostPayload = {
  createPost?: {
    __typename?: string;
    message?: string | null;
    post?: {
      id?: string;
      status?: string | null;
      sentAt?: string | null;
      error?: { message?: string | null } | null;
      externalLink?: string | null;
    } | null;
  } | null;
};

type PostMetricsPayload = {
  post?: {
    id?: string;
    status?: string | null;
    sentAt?: string | null;
    externalLink?: string | null;
    error?: { message?: string | null } | null;
    metrics?: Array<{
      type?: string | null;
      name?: string | null;
      value?: number | null;
      unit?: string | null;
    }> | null;
    metricsUpdatedAt?: string | null;
  } | null;
};

export type BufferHealth = {
  organizationId: string;
  channelId: string;
  channelName: string;
};

export type BufferMetricsSnapshot = {
  status?: string;
  sentAt?: string;
  externalUrl?: string;
  errorMessage?: string;
  normalized: ThreadsMetrics;
  raw: Record<string, number>;
  updatedAt?: string;
};

export type BufferPublishResult = {
  id: string;
  status: string;
  externalUrl?: string;
  sentAt?: string;
  errorMessage?: string;
};

export class RetryableBufferError extends Error {
  override readonly name = "RetryableBufferError";
}

export class AmbiguousBufferPublishError extends Error {
  override readonly name = "AmbiguousBufferPublishError";
}

export class BufferConfigurationError extends Error {
  override readonly name = "BufferConfigurationError";
}

function describeUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimit(errors: GraphQLError[]): boolean {
  return errors.some((error) => {
    const code = error.extensions?.code?.toUpperCase() ?? "";
    const message = error.message?.toLowerCase() ?? "";
    return code.includes("RATE") || message.includes("rate limit") || message.includes("too many");
  });
}

export class BufferProvider {
  private cachedHealth?: BufferHealth;
  private rateWindows?: BufferRateWindow[];

  constructor(
    private readonly apiKey: string,
    private readonly channelId?: string,
    private readonly organizationId?: string,
    private readonly endpoint = "https://api.buffer.com"
  ) {}

  private async query<T>(
    query: string,
    variables: Record<string, unknown> = {},
    mutation = false
  ): Promise<T> {
    if (this.rateWindows) {
      const budgetBlock = assessBufferBudget(this.rateWindows);
      if (budgetBlock) throw new RetryableBufferError(budgetBlock);
    }
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.apiKey
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (error) {
      if (mutation) {
        throw new AmbiguousBufferPublishError(
          "Network failure during Buffer createPost; publication state cannot be proven safely: " +
          describeUnknown(error)
        );
      }
      throw new RetryableBufferError("Buffer network failure: " + describeUnknown(error));
    }

    if (response.status === 429) {
      throw new RetryableBufferError("Buffer API rate limit reached; wait for Retry-After");
    }

    // All Buffer GraphQL responses are documented to include three RateLimit windows.
    // Never log the token or dump response headers, and never blindly retry a mutation.
    const windows = readBufferRateWindows(response.headers.get("ratelimit"));
    if (windows.length !== 3) {
      const reason = "Buffer did not supply complete rolling rate-limit headers";
      if (mutation) throw new AmbiguousBufferPublishError(reason + " during createPost");
      throw new RetryableBufferError(reason);
    }
    this.rateWindows = windows;

    if (!response.ok) {
      const detail = await response.text();
      if (response.status >= 500) {
        if (mutation) {
          throw new AmbiguousBufferPublishError(
            "Buffer createPost returned HTTP " + response.status +
            "; publication state cannot be proven safely: " + detail.slice(0, 800)
          );
        }
        throw new RetryableBufferError(
          "Buffer API temporarily unavailable: " + response.status + " " + detail.slice(0, 800)
        );
      }
      throw new BufferConfigurationError(
        "Buffer API request failed: " + response.status + " " + detail.slice(0, 800)
      );
    }

    const payload = await response.json() as GraphQLResponse<T>;
    const errors = payload.errors ?? [];
    if (errors.length > 0) {
      if (isRateLimit(errors)) {
        throw new RetryableBufferError(
          "Buffer GraphQL rate limit: " + errors.map((error) => error.message ?? "unknown").join("; ")
        );
      }
      throw new BufferConfigurationError(
        "Buffer GraphQL error: " + errors.map((error) => error.message ?? "unknown").join("; ")
      );
    }

    if (!payload.data) {
      throw new RetryableBufferError("Buffer GraphQL response did not contain data");
    }
    return payload.data;
  }

  private async organizations(): Promise<Organization[]> {
    const data = await this.query<{ account?: { organizations?: Organization[] | null } | null }>(
      `query GetOrganizations {
        account {
          organizations {
            id
            name
          }
        }
      }`
    );
    return data.account?.organizations ?? [];
  }

  private async channels(organizationId: string): Promise<Channel[]> {
    const data = await this.query<{ channels?: Channel[] | null }>(
      `query GetChannels($input: ChannelsInput!) {
        channels(input: $input) {
          id
          name
          displayName
          service
          isDisconnected
          isLocked
        }
      }`,
      { input: { organizationId } }
    );
    return data.channels ?? [];
  }

  async healthCheck(): Promise<BufferHealth> {
    if (this.cachedHealth) return this.cachedHealth;

    const organizations = this.organizationId
      ? [{ id: this.organizationId }]
      : await this.organizations();

    if (organizations.length === 0) {
      throw new BufferConfigurationError("No Buffer organizations are available to this API key");
    }

    const candidates: Array<{ organizationId: string; channel: Channel }> = [];

    for (const organization of organizations) {
      for (const channel of await this.channels(organization.id)) {
        if (this.channelId && channel.id !== this.channelId) continue;
        if ((channel.service ?? "").toLowerCase() !== "threads") continue;
        if (channel.isDisconnected === true || channel.isLocked === true) continue;
        candidates.push({ organizationId: organization.id, channel });
      }
    }

    if (candidates.length === 0) {
      throw new BufferConfigurationError(
        this.channelId
          ? "BUFFER_CHANNEL_ID does not resolve to an active Threads channel"
          : "No active Threads channel is connected to this Buffer account"
      );
    }

    if (candidates.length > 1) {
      throw new BufferConfigurationError(
        "More than one active Threads channel is connected. Set BUFFER_CHANNEL_ID to choose one explicitly."
      );
    }

    const selected = candidates[0]!;
    const health: BufferHealth = {
      organizationId: selected.organizationId,
      channelId: selected.channel.id,
      channelName: selected.channel.displayName ?? selected.channel.name ?? selected.channel.id
    };
    this.cachedHealth = health;
    return health;
  }

  async publish(job: ThreadsJob, imageUrls: string[] | string = []): Promise<BufferPublishResult> {
    const mediaUrls = typeof imageUrls === "string" ? [imageUrls] : imageUrls;
    if (job.action !== "post") {
      throw new BufferConfigurationError(
        "Buffer provider currently supports root Threads posts only; reply/quote jobs must use the direct Threads provider"
      );
    }

    const health = await this.healthCheck();
    const input: Record<string, unknown> = {
      text: job.content.text,
      channelId: health.channelId,
      schedulingType: "automatic",
      mode: "shareNow",
      aiAssisted: true,
      ...(job.content.topic_tag
        ? { metadata: { threads: { topic: job.content.topic_tag } } }
        : {})
    };

    if (mediaUrls.length > 0) {
      if (mediaUrls.length > 20) {
        throw new BufferConfigurationError("Threads supports at most 20 images per post");
      }
      input.assets = mediaUrls.map((url, index) => ({
        image: {
          url,
          ...(index === 0 && job.visual.mode === "card"
            ? { metadata: { altText: job.visual.alt_text } }
            : {})
        }
      }));
    }

    const data = await this.query<CreatePostPayload>(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess {
            post {
              id
              status
              sentAt
              externalLink
              error { message }
            }
          }
          ... on MutationError {
            message
          }
        }
      }`,
      { input },
      true
    );

    const result = data.createPost;
    if (!result) {
      throw new AmbiguousBufferPublishError(
        "Buffer createPost returned no result; publication state cannot be proven safely"
      );
    }

    if (result.__typename !== "PostActionSuccess") {
      throw new BufferConfigurationError(
        "Buffer rejected createPost: " + (result.message ?? result.__typename ?? "unknown mutation error")
      );
    }

    const postId = result.post?.id;
    if (!postId) {
      throw new AmbiguousBufferPublishError(
        "Buffer reported success without a post id; publication state cannot be proven safely"
      );
    }

    return {
      id: postId,
      status: result.post?.status ?? "unknown",
      ...(result.post?.sentAt ? { sentAt: result.post.sentAt } : {}),
      ...(result.post?.error?.message ? { errorMessage: result.post.error.message } : {}),
      ...(result.post?.externalLink ? { externalUrl: result.post.externalLink } : {})
    };
  }

  async getMetrics(postId: string): Promise<BufferMetricsSnapshot> {
    const data = await this.query<PostMetricsPayload>(
      `query GetPostMetrics($input: PostInput!) {
        post(input: $input) {
          id
          status
          sentAt
          externalLink
          error { message }
          metrics {
            type
            name
            value
            unit
          }
          metricsUpdatedAt
        }
      }`,
      { input: { id: postId } }
    );

    const metrics = data.post?.metrics ?? [];
    const raw: Record<string, number> = {};
    const normalized: ThreadsMetrics = {};

    for (const metric of metrics) {
      if (typeof metric.value !== "number") continue;
      const key = (metric.type ?? metric.name ?? "unknown").trim();
      if (!key) continue;
      raw[key] = metric.value;

      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
      if (normalizedKey === "views" || normalizedKey === "view") {
        normalized.views = metric.value;
      } else if (normalizedKey === "impressions" || normalizedKey === "impression") {
        normalized.impressions = metric.value;
      } else if (normalizedKey === "reach") {
        normalized.reach = metric.value;
      } else if (
        normalizedKey === "likes" ||
        normalizedKey === "like" ||
        normalizedKey === "reactions" ||
        normalizedKey === "reaction"
      ) {
        normalized.likes = metric.value;
      } else if (
        normalizedKey === "replies" ||
        normalizedKey === "reply" ||
        normalizedKey === "comments" ||
        normalizedKey === "comment"
      ) {
        normalized.replies = metric.value;
      } else if (
        normalizedKey === "reposts" ||
        normalizedKey === "repost"
      ) {
        normalized.reposts = metric.value;
      } else if (normalizedKey === "shares" || normalizedKey === "share") {
        normalized.shares = metric.value;
      } else if (normalizedKey === "quotes" || normalizedKey === "quote") {
        normalized.quotes = metric.value;
      } else if (normalizedKey === "engagementrate") {
        normalized.engagement_rate = metric.value;
      }
    }

    return {
      normalized,
      raw,
      ...(data.post?.status ? { status: data.post.status } : {}),
      ...(data.post?.sentAt ? { sentAt: data.post.sentAt } : {}),
      ...(data.post?.externalLink ? { externalUrl: data.post.externalLink } : {}),
      ...(data.post?.error?.message ? { errorMessage: data.post.error.message } : {}),
      ...(data.post?.metricsUpdatedAt ? { updatedAt: data.post.metricsUpdatedAt } : {})
    };
  }
}
