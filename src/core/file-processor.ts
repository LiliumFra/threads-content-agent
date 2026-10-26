import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  AmbiguousBufferPublishError,
  BufferConfigurationError,
  BufferProvider,
  RetryableBufferError
} from "../buffer/provider.js";
import { contentHash, jobSchema, type ThreadsJob } from "../domain/job.js";
import { assertCloudinaryFreeCredits, CloudinaryBudgetError, uploadEditorialJpeg, uploadRemoteImage } from "../media/cloudinary.js";
import { renderCard } from "../render/card.js";
import {
  AmbiguousPublishError,
  RetryableThreadsError,
  ThreadsProvider
} from "../threads/provider.js";
import { evaluatePolicy, type Policy } from "./policy.js";
import { captureMetricSnapshots } from "./metrics-snapshots.js";

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

function dayKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [value.year, value.month, value.day].join("-");
}

/**
 * Count distinct Cloudinary assets created on the current policy day.
 * FAILED/REVIEW deliveries can still have incurred a media upload.
 * Reused URLs across failed-and-retried jobs must not be double-counted.
 * Unknown timestamps on recorded uploads are unsafe: defer new media.
 */
export function countDailyMediaUploads(jobs: ThreadsJob[], now: Date, timezone: string): number {
  const today = dayKey(now, timezone);
  const uploaded = new Set<string>();

  for (const job of jobs) {
    const result = job.result;
    if (!result) continue;
    const urls = result.media_urls?.length ? result.media_urls : result.media_url ? [result.media_url] : [];
    if (urls.length === 0) continue;
    const recordedAt = result.submitted_at ?? result.published_at;
    const timestamp = recordedAt ? new Date(recordedAt) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) {
      throw new CloudinaryBudgetError("Daily Cloudinary upload history has an unknown timestamp; media uploads deferred");
    }
    if (dayKey(timestamp, timezone) !== today) continue;
    for (const url of urls) uploaded.add(url);
  }
  return uploaded.size;
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
        // A Buffer-accepted post still reserves a publishing slot until delivery is reconciled.
        // This avoids duplicate posts or rate spikes while Buffer is "sending".
        if (job.status === "PUBLISHED") jobs.push(job);
        else if (job.status === "DELIVERY_PENDING" || (job.status === "REVIEW" && job.result?.provider_post_id)) {
          const reservedAt = job.result?.submitted_at ?? job.result?.published_at;
          if (reservedAt) {
            jobs.push({ ...job, result: { ...job.result!, published_at: reservedAt } });
          }
        }
      } catch {}
    }
    return jobs.sort((a, b) => {
      const left = a.result?.published_at ? new Date(a.result.published_at).getTime() : 0;
      const right = b.result?.published_at ? new Date(b.result.published_at).getTime() : 0;
      return right - left;
    });
  }


  private async mediaUploadCeiling(): Promise<number> {
    try {
      const growth = JSON.parse(await readFile("config/growth.json", "utf8")) as {
        free_tier_governor?: { cloudinary?: { max_new_images_per_day?: number } };
      };
      return growth.free_tier_governor?.cloudinary?.max_new_images_per_day ?? 8;
    } catch {
      return 8;
    }
  }

  private async mediaUploadsToday(now: Date): Promise<number> {
    const jobs: ThreadsJob[] = [];
    for (const path of await listJson(this.resultsDir)) {
      try {
        jobs.push(await readJob(path));
      } catch {
        throw new CloudinaryBudgetError(
          "Daily Cloudinary upload history could not be verified; media uploads deferred"
        );
      }
    }
    return countDailyMediaUploads(jobs, now, this.config.policy.timezone);
  }

  private async persistTerminal(pendingPath: string, job: ThreadsJob): Promise<void> {
    await mkdir(this.resultsDir, { recursive: true });
    await writeJob(this.resultPath(pendingPath), job);
    await unlink(pendingPath);
  }

  /** A repeated event cannot be re-queued under a new title, language or image.
   * Include FAILED/REVIEW/sending results and other pending jobs; none imply
   * delivery, but all require reconciliation before a replay.
   */
  private async recordedEventDuplicate(candidate: ThreadsJob, currentPath: string): Promise<string | null> {
    const eventKey = candidate.strategy.event_key;
    if (!eventKey) return null;
    for (const dir of [this.resultsDir, this.pendingDir]) {
      for (const otherPath of await listJson(dir)) {
        if (otherPath === currentPath) continue;
        // Unreadable history is an uncertainty, not proof that a retry is safe.
        const other = await readJob(otherPath);
        if (other.strategy.event_key === eventKey) return basename(otherPath);
      }
    }
    return null;
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

    // Stop cross-language event reuse even after a FAILED or uncertain Buffer
    // delivery. REVIEW is non-delivered and never retried automatically.
    let previouslyRecorded: string | null;
    try {
      previouslyRecorded = await this.recordedEventDuplicate(job, path);
    } catch {
      return "queued:event-history-unverifiable";
    }
    if (previouslyRecorded) {
      const review: ThreadsJob = {
        ...job,
        status: "REVIEW",
        result: {
          status: "REVIEW",
          content_hash: contentHash(job),
          error: "Event key already recorded in " + previouslyRecorded + "; verify delivery and distinct claim before a new job."
        }
      };
      await this.persistTerminal(path, review);
      return "review:duplicate-news-event";
    }

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
        if (png) {
          if (!this.config.cloudinary) return "queued:Cloudinary secrets required for an image post";
          // Verify rolling 30-day credits BEFORE consuming Buffer requests or uploading.
          await assertCloudinaryFreeCredits(this.config.cloudinary);
        }
        const buffer = this.bufferProvider();
        await buffer.healthCheck();

        const mediaUrls: string[] = [];
        const mediaCeiling = await this.mediaUploadCeiling();
        let usedMediaUploads = await this.mediaUploadsToday(now);

        if (png) {
          if (!this.config.cloudinary) throw new Error("Image job requires Cloudinary secrets");
          if (usedMediaUploads >= mediaCeiling) {
            return "queued:Cloudinary daily media ceiling reached";
          }
          mediaUrl = await uploadEditorialJpeg(
            png,
            "threads-" + hash.slice(0, 20),
            this.config.cloudinary
          );
          mediaUrls.push(mediaUrl);
          usedMediaUploads += 1;
        }

        const source = job.source_media;
        if (
          source?.publishable &&
          source.rights !== "reference_only" &&
          this.config.cloudinary &&
          usedMediaUploads < mediaCeiling
        ) {
          try {
            // Optional source image may be omitted if total account credits are uncertain.
            await assertCloudinaryFreeCredits(this.config.cloudinary);
            const sourceUrl = await uploadRemoteImage(
              source.image_url,
              "threads-source-" + hash.slice(0, 20),
              this.config.cloudinary
            );
            mediaUrls.push(sourceUrl);
            usedMediaUploads += 1;
          } catch {
            // Source media is optional. The original editorial visual remains the safe fallback.
          }
        }

        const bufferPost = await buffer.publish(job, mediaUrls);
        const deliveryStatus = bufferPost.status;
        const finalStatus: ThreadsJob["status"] = deliveryStatus === "sent"
          ? "PUBLISHED"
          : deliveryStatus === "error"
            ? "FAILED"
            : (deliveryStatus === "sending" || deliveryStatus === "scheduled")
              ? "DELIVERY_PENDING"
              : "REVIEW";
        const recorded: ThreadsJob = {
          ...job,
          status: finalStatus,
          result: {
            status: finalStatus,
            submitted_at: now.toISOString(),
            provider: "buffer",
            provider_status: deliveryStatus,
            provider_post_id: bufferPost.id,
            content_hash: hash,
            ...(finalStatus === "PUBLISHED"
              ? { published_at: bufferPost.sentAt ?? now.toISOString() }
              : {}),
            ...(bufferPost.errorMessage ? { error: bufferPost.errorMessage.slice(0, 2000) } : {}),
            ...(bufferPost.externalUrl ? { external_url: bufferPost.externalUrl } : {}),
            ...(mediaUrl ? { media_url: mediaUrl } : {}),
            ...(mediaUrls.length ? { media_urls: mediaUrls } : {})
          }
        };
        await this.persistTerminal(path, recorded);
        return finalStatus === "PUBLISHED" ? "published:buffer" :
          finalStatus === "FAILED" ? "failed:buffer-delivery" :
          finalStatus === "DELIVERY_PENDING" ? "awaiting:buffer-delivery" : "review:buffer-delivery-unverified";
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
        mediaUrl = await uploadEditorialJpeg(
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
      if (error instanceof CloudinaryBudgetError) {
        return "queued:" + error.message;
      }
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
        if (!previousResult || !["PUBLISHED", "DELIVERY_PENDING", "REVIEW"].includes(job.status)) {
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
          const observed = snapshot.status ?? "unknown";
          const status: ThreadsJob["status"] = observed === "sent" ? "PUBLISHED" :
            observed === "error" ? "FAILED" :
              (observed === "sending" || observed === "scheduled") ? "DELIVERY_PENDING" : "REVIEW";
          const nextResult: NonNullable<ThreadsJob["result"]> = {
            ...previousResult,
            status,
            provider_status: observed,
            submitted_at: previousResult.submitted_at ?? previousResult.published_at ?? new Date().toISOString(),
            ...(snapshot.externalUrl ? { external_url: snapshot.externalUrl } : {}),
            ...(snapshot.errorMessage ? { error: snapshot.errorMessage.slice(0, 2000) } : {})
          };
          if (status === "PUBLISHED") {
            nextResult.published_at = snapshot.sentAt ?? previousResult.published_at ?? new Date().toISOString();
            nextResult.metrics = snapshot.normalized;
            nextResult.provider_metrics = snapshot.raw;
            nextResult.metrics_updated_at = snapshot.updatedAt ?? new Date().toISOString();
            // Store bounded, immutable 24h/72h readings from the existing
            // daily fetch. Never synthesize historical data from lifetime views.
            nextResult.metrics_snapshots = captureMetricSnapshots(
              previousResult.metrics_snapshots,
              snapshot.normalized,
              nextResult.published_at,
              nextResult.metrics_updated_at
            );
            delete nextResult.error;
          } else {
            delete nextResult.published_at;
            delete nextResult.metrics;
            delete nextResult.provider_metrics;
            delete nextResult.metrics_updated_at;
          }
          const next: ThreadsJob = { ...job, status, result: nextResult };
          await writeJob(path, next);
          results[basename(path)] = "buffer:" + observed;
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
