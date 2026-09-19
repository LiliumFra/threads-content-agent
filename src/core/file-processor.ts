import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { contentHash, jobSchema, type ThreadsJob } from "../domain/job.js";
import { uploadPng } from "../media/cloudinary.js";
import { renderCard } from "../render/card.js";
import { ThreadsProvider } from "../threads/provider.js";
import { evaluatePolicy, type Policy } from "./policy.js";

export type FileProcessorConfig = {
  policy: Policy;
  pendingDir?: string;
  resultsDir?: string;
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

  constructor(private readonly config: FileProcessorConfig) {
    this.pendingDir = config.pendingDir ?? "jobs/pending";
    this.resultsDir = config.resultsDir ?? "jobs/results";
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

      if (!this.config.threadsAccessToken) throw new Error("THREADS_ACCESS_TOKEN is not configured");

      let mediaUrl: string | undefined;
      if (png) {
        if (!this.config.cloudinary) throw new Error("Image job requires Cloudinary secrets");
        mediaUrl = await uploadPng(png, "threads-" + hash.slice(0, 20), this.config.cloudinary);
      }

      const threads = new ThreadsProvider(this.config.threadsAccessToken, this.config.threadsApiHost);
      const threadId = await threads.publish(job, mediaUrl);
      const published: ThreadsJob = {
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
      await this.persistTerminal(path, published);
      return "published";
    } catch (error) {
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
    if (!this.config.threadsAccessToken) throw new Error("THREADS_ACCESS_TOKEN is required for metrics");
    const threads = new ThreadsProvider(this.config.threadsAccessToken, this.config.threadsApiHost);
    const results: Record<string, string> = {};

    for (const path of await listJson(this.resultsDir)) {
      try {
        const job = await readJob(path);
        const previousResult = job.result;
        const threadId = previousResult?.thread_id;
        if (job.status !== "PUBLISHED" || !previousResult || !threadId) {
          results[basename(path)] = "skipped";
          continue;
        }

        const metrics = await threads.getInsights(threadId);
        const next: ThreadsJob = {
          ...job,
          result: {
            ...previousResult,
            metrics,
            metrics_updated_at: new Date().toISOString()
          }
        };
        await writeJob(path, next);
        results[basename(path)] = "updated";
      } catch (error) {
        results[basename(path)] = "error:" + (error instanceof Error ? error.message : String(error));
      }
    }
    return results;
  }
}
