import { contentHash, type ThreadsJob } from "../domain/job.js";
import { type GitHubIssue, GitHubClient } from "../github/client.js";
import { uploadPng } from "../media/cloudinary.js";
import { renderCard } from "../render/card.js";
import { ThreadsProvider } from "../threads/provider.js";
import { evaluatePolicy, type Policy } from "./policy.js";

const READY = "threads:ready";
const PROCESSING = "threads:processing";
const PUBLISHED = "threads:published";
const FAILED = "threads:failed";
const DRY_RUN = "threads:dry-run";

export type ProcessorConfig = {
  github: GitHubClient;
  policy: Policy;
  threadsAccessToken?: string;
  threadsApiHost?: string;
  cloudinary?: { cloudName: string; apiKey: string; apiSecret: string; folder?: string };
};

export class Processor {
  constructor(private readonly config: ProcessorConfig) {}

  private async publishedJobs(): Promise<ThreadsJob[]> {
    const jobs: ThreadsJob[] = [];
    for (const issue of await this.config.github.listIssues("closed", PUBLISHED)) {
      try {
        const job = this.config.github.parseJob(issue);
        if (job.status === "PUBLISHED") jobs.push(job);
      } catch {}
    }
    return jobs;
  }

  private async setFailure(issue: GitHubIssue, job: ThreadsJob, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const next: ThreadsJob = {
      ...job,
      status: "FAILED",
      result: { status: "FAILED", content_hash: contentHash(job), error: message.slice(0, 2000) }
    };
    await this.config.github.saveJob(issue.number, next, [FAILED], "open");
    await this.config.github.comment(issue.number, "Threads agent failed closed. Error: " + message.slice(0, 1500));
  }

  async processIssue(number: number, now = new Date()): Promise<string> {
    await this.config.github.ensureOperationalLabels();
    const issue = await this.config.github.getIssue(number);
    if (!issue.title.startsWith("[Threads Job]")) return "ignored:title";

    let job: ThreadsJob;
    try {
      job = this.config.github.parseJob(issue);
    } catch (error) {
      await this.config.github.comment(number, "Invalid Threads job: " + (error instanceof Error ? error.message : String(error)));
      return "invalid";
    }

    if (job.status !== "READY") return "ignored:status";
    await this.config.github.saveJob(number, job, [READY], "open");

    if (new Date(job.publish_at).getTime() > now.getTime()) return "queued:not-due";

    const decision = evaluatePolicy(job, await this.publishedJobs(), this.config.policy, now);
    if (!decision.ok) {
      if (!decision.retryable) {
        await this.setFailure(issue, job, new Error(decision.reason));
        return "failed:policy";
      }
      return "queued:" + decision.reason;
    }

    await this.config.github.saveJob(number, job, [PROCESSING], "open");

    try {
      const hash = contentHash(job);
      const png = job.visual.mode === "card" ? await renderCard(job) : undefined;

      if (job.dry_run) {
        const next: ThreadsJob = {
          ...job,
          status: "DRY_RUN",
          result: { status: "DRY_RUN", published_at: now.toISOString(), content_hash: hash }
        };
        await this.config.github.saveJob(number, next, [DRY_RUN], "closed");
        return "dry-run";
      }

      if (!this.config.threadsAccessToken) throw new Error("THREADS_ACCESS_TOKEN is not configured");

      let mediaUrl: string | undefined;
      if (png) {
        if (!this.config.cloudinary) throw new Error("Image job requires Cloudinary secrets");
        mediaUrl = await uploadPng(png, "threads-" + hash.slice(0, 20), this.config.cloudinary);
      }

      const threads = new ThreadsProvider(this.config.threadsAccessToken, this.config.threadsApiHost);
      const threadId = await threads.publish(job, mediaUrl);
      const next: ThreadsJob = {
        ...job,
        status: "PUBLISHED",
        result: {
          status: "PUBLISHED",
          published_at: now.toISOString(),
          thread_id: threadId,
          content_hash: hash,
          ...(mediaUrl ? { media_url: mediaUrl } : {})
        }
      };
      await this.config.github.saveJob(number, next, [PUBLISHED], "closed");
      await this.config.github.comment(number, "Published successfully to Threads. Thread ID: " + threadId);
      return "published";
    } catch (error) {
      await this.setFailure(issue, job, error);
      return "failed";
    }
  }

  async processQueue(): Promise<Record<string, string>> {
    await this.config.github.ensureOperationalLabels();
    const results: Record<string, string> = {};
    for (const issue of (await this.config.github.listIssues("open", READY)).sort((a, b) => a.number - b.number)) {
      results[String(issue.number)] = await this.processIssue(issue.number);
    }
    return results;
  }

  async refreshMetrics(): Promise<Record<string, string>> {
    await this.config.github.ensureOperationalLabels();
    if (!this.config.threadsAccessToken) throw new Error("THREADS_ACCESS_TOKEN is required for metrics");
    const threads = new ThreadsProvider(this.config.threadsAccessToken, this.config.threadsApiHost);
    const results: Record<string, string> = {};

    for (const issue of await this.config.github.listIssues("closed", PUBLISHED)) {
      try {
        const job = this.config.github.parseJob(issue);
        const threadId = job.result?.thread_id;
        if (!threadId || job.status !== "PUBLISHED") {
          results[String(issue.number)] = "skipped";
          continue;
        }
        const metrics = await threads.getInsights(threadId);
        const next: ThreadsJob = {
          ...job,
          result: { ...job.result, metrics, metrics_updated_at: new Date().toISOString() }
        };
        await this.config.github.saveJob(issue.number, next, [PUBLISHED], "closed");
        results[String(issue.number)] = "updated";
      } catch (error) {
        results[String(issue.number)] = "error:" + (error instanceof Error ? error.message : String(error));
      }
    }
    return results;
  }
}
