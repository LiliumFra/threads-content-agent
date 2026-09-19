import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  AmbiguousBufferPublishError,
  BufferConfigurationError,
  BufferProvider,
  RetryableBufferError
} from "../buffer/provider.js";
import { contentHash, jobSchema, type ThreadsJob } from "../domain/job.js";
import { uploadPng } from "../media/cloudinary.js";
import { renderCard } from "../render/card.js";
import {
  AmbiguousPublishError,
  RetryableThreadsError,
  ThreadsProvider
} from "../threads/provider.js";
import { evaluatePolicy, type Policy } from "./policy.js";

export type FileProcessorConfig = {
  policy: Policy;
  pendingDir?: string;
  resultsDir?: string;
  publishProvider?: "buffer" | "threads";
  bufferApiKey?: string;
  bufferChannelId?: string;
  bufferOrganizationId?: string;
  bufferApiHost?: string;
  threadsAccessToken?: string;
  threadsApiHost?: string;
  cloudinary?: { cloudName: string; apiKey: string; apiSecret: string; folder?: string };
};

async function listJson(dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  return (await readdir(dir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(dir, name));
}

async function readJob(path: string): Promise<ThreadsJob> {
  return jobSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

async function writeJob(path: string, job: ThreadsJob): Promise<void> {
  await writeFile(path, JSON.stringify(job, null, 2) + "\n", "utf8");
}

export class FileProcessor {
  private readonly pendingDir: string;
  private readonly resultsDir: string;
  private buffer?: BufferProvider;
  private threads?: ThreadsProvider;

  constructor(private readonly config: FileProcessorConfig) {
    this.pendingDir = config.pendingDir ?? "jobs/pending";
    this.resultsDir = config.resultsDir ?? "jobs/results";
  }

  private providerName(): "buffer" | "threads" {
    return this.config.publishProvider ?? "buffer";
  }

  private bufferProvider(): BufferProvider {
    if (!this.config.bufferApiKey) {
      throw new BufferConfigurationError("BUFFER_API_KEY is not configured");
    }
    this.buffer ??= new BufferProvider(
      this.config.bufferApiKey,
      this.config.bufferChannelId,
      this.config.bufferOrganizationId,
      this.config.bufferApiHost
    );
    return this.buffer;
  }

  private threadsProvider(): ThreadsProvider {
    if (!this.config.threadsAccessToken) {
      throw new Error("THREADS_ACCESS_TOKEN is not configured");
    }
    this.threads ??= new ThreadsProvider(
      this.config.threadsAccessToken,
      this.config.threadsApiHost
    );
    return this.threads;
  }

  private resultPath(pendingPath: string): string {
    return join(this.resultsDir, basename(pendingPath));
  }

  private async publishedJobs(): Promise<ThreadsJob[]> {
    const jobs: ThreadsJob[] = [];
    for (const path of await listJson(this.resultsDir)) {
      try {
        const job = await readJob(path);
        if (job.status === "PUBLISHED") jobs.push(job);
      } catch {}
    }
    return jobs.sort((a, b) => {
      const left = a.result?.published_at ? new Date(a.result.published_at).getTime() : 0;
      const right = b.result?.published_at ? new Date(b.result.published_at).getTime() : 0;
      return right - left;
    });
  }

  private async persistTerminal(pendingPath: string, job: ThreadsJob): Promise<void> {
    await mkdir(this.resultsDir, { recursive: true });
    await writeJob(this.resultPath(pendingPath), job);
    await unlink(pendingPath);
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    if (this.providerName() === "buffer") {
      const health = await this.bufferProvider().healthCheck();
      return { provider: "buffer", ...health };
    }
    if (!this.config.threadsAccessToken) {
      throw new Error("THREADS_ACCESS_TOKEN is not configured");
    }
    return { provider: "threads", configured: true };
  }

  async processFile(path: string, now = new Date()): Promise<string> {
    const resultPath = this.resultPath(path);
    try {
      await readFile(resultPath, "utf8");
      return "ignored:result-exists";
    } catch {}

    let job: ThreadsJob;
    try {
      job = await readJob(path);
    } catch (error) {
      return "invalid:" + (error instanceof Error ? error.message : String(error));
    }

    if (job.status !== "READY") return "ignored:status";
    if (new Date(job.publish_at).getTime() > now.getTime()) return "queued:not-due";

    const decision = evaluatePolicy(job, await this.publishedJobs(), this.config.policy, now);
    if (!decision.ok) {
      if (decision.retryable) return "queued:" + decision.reason;

      const failed: ThreadsJob = {
        ...job,
        status: "FAILED",
        result: {
          status: "FAILED",
          content_hash: contentHash(job),
          error: decision.reason
        }
      };
      await this.persistTerminal(path, failed);
      return "failed:policy";
    }

    const hash = contentHash(job);

    try {
      const png = job.visual.mode === "card" ? await renderCard(job) : undefined;

      if (job.dry_run) {
        const dryRun: ThreadsJob = {
          ...job,
          status: "DRY_RUN",
          result: {
            status: "DRY_RUN",
            published_at: now.toISOString(),
            content_hash: hash
          }
        };
        await this.persistTerminal(path, dryRun);
        return "dry-run";
      }

      let mediaUrl: string | undefined;
      const provider = this.providerName();

      if (provider === "buffer") {
        const buffer = this.bufferProvider();
        await buffer.healthCheck();

        if (png) {
          if (!this.config.cloudinary) throw new Error("Image job requires Cloudinary secrets");
          mediaUrl = await uploadPng(
            png,
            "threads-" + hash.slice(0, 20),
            this.config.cloudinary
          );
        }

        const publishedPost = await buffer.publish(job, mediaUrl);
        const published: ThreadsJob = {
          ...job,
          status: "PUBLISHED",
          result: {
            status: "PUBLISHED",
            published_at: now.toISOString(),
            provider: "buffer",
            provider_post_id: publishedPost.id,
            content_hash: hash,
            ...(publishedPost.externalUrl ? { external_url: publishedPost.externalUrl } : {}),
            ...(mediaUrl ? { media_url: mediaUrl } : {})
          }
        };
        await this.persistTerminal(path, published);
        return "published:buffer";
      }

      const threads = this.threadsProvider();
      const quota = await threads.getPublishingQuota();
      const quotaExhausted = job.action === "reply"
        ? quota.replyUsage >= quota.replyTotal
        : quota.postUsage >= quota.postTotal;

      if (quotaExhausted) {
        return "queued:Threads API publishing quota exhausted";
      }

      if (png) {
        if (!this.config.cloudinary) throw new Error("Image job requires Cloudinary secrets");
        mediaUrl = await uploadPng(
          png,
          "threads-" + hash.slice(0, 20),
          this.config.cloudinary
        );
      }

      const threadId = await threads.publish(job, mediaUrl);
      const published: ThreadsJob = {
        ...job,
        status: "PUBLISHED",
        result: {
          status: "PUBLISHED",
          published_at: now.toISOString(),
          provider: "threads",
          provider_post_id: threadId,
          thread_id: threadId,
          content_hash: hash,
          ...(mediaUrl ? { media_url: mediaUrl } : {})
        }
      };
      await this.persistTerminal(path, published);
      return "published:threads";
    } catch (error) {
      if (error instanceof RetryableBufferError || error instanceof RetryableThreadsError) {
        return "queued:" + error.message;
      }

      if (error instanceof AmbiguousBufferPublishError || error instanceof AmbiguousPublishError) {
        const review: ThreadsJob = {
          ...job,
          status: "REVIEW",
          result: {
            status: "REVIEW",
            content_hash: hash,
            error: error.message.slice(0, 2000)
          }
        };
        await this.persistTerminal(path, review);
        return "review:" + error.message;
      }

      const message = error instanceof Error ? error.message : String(error);
      const failed: ThreadsJob = {
        ...job,
        status: "FAILED",
        result: {
          status: "FAILED",
          content_hash: hash,
          error: message.slice(0, 2000)
        }
      };
      await this.persistTerminal(path, failed);
      return "failed:" + message;
    }
  }

  async processQueue(): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    for (const path of await listJson(this.pendingDir)) {
      results[basename(path)] = await this.processFile(path);
    }
    return results;
  }

  async refreshMetrics(): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const paths = (await listJson(this.resultsDir)).reverse().slice(0, 30);

    for (const path of paths) {
      try {
        const job = await readJob(path);
        const previousResult = job.result;
        if (job.status !== "PUBLISHED" || !previousResult) {
          results[basename(path)] = "skipped";
          continue;
        }

        if (previousResult.provider === "buffer") {
          const postId = previousResult.provider_post_id;
          if (!postId) {
            results[basename(path)] = "skipped:no-buffer-post-id";
            continue;
          }
          const snapshot = await this.bufferProvider().getMetrics(postId);
          const next: ThreadsJob = {
            ...job,
            result: {
              ...previousResult,
              metrics: snapshot.normalized,
              provider_metrics: snapshot.raw,
              metrics_updated_at: snapshot.updatedAt ?? new Date().toISOString()
            }
          };
          await writeJob(path, next);
          results[basename(path)] = "updated:buffer";
          continue;
        }

        const threadId = previousResult.provider_post_id ?? previousResult.thread_id;
        if (!threadId) {
          results[basename(path)] = "skipped:no-thread-id";
          continue;
        }
        const metrics = await this.threadsProvider().getInsights(threadId);
        const next: ThreadsJob = {
          ...job,
          result: {
            ...previousResult,
            metrics,
            metrics_updated_at: new Date().toISOString()
          }
        };
        await writeJob(path, next);
        results[basename(path)] = "updated:threads";
      } catch (error) {
        results[basename(path)] = "error:" + (
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return results;
  }
}
