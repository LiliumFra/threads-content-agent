import type { ThreadsJob } from "../domain/job.js";
import { parseIssueBody, serializeJob } from "../domain/job.js";

export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<string | { name?: string }>;
  pull_request?: unknown;
};

type RequestInitJson = RequestInit & { json?: unknown };

export class GitHubClient {
  private readonly owner: string;
  private readonly repo: string;

  constructor(private readonly token: string, repository: string, private readonly apiUrl = "https://api.github.com") {
    const parts = repository.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("GITHUB_REPOSITORY must be owner/repo");
    this.owner = parts[0];
    this.repo = parts[1];
  }

  private async request<T>(path: string, init: RequestInitJson = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("Authorization", "Bearer " + this.token);
    if (init.json !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(this.apiUrl + path, {
      ...init,
      headers,
      body: init.json === undefined ? init.body : JSON.stringify(init.json)
    });

    if (!response.ok) {
      const error = new Error("GitHub API " + response.status + ": " + await response.text());
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async getIssue(number: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>("/repos/" + this.owner + "/" + this.repo + "/issues/" + number);
  }

  async listIssues(state: "open" | "closed" | "all", label?: string): Promise<GitHubIssue[]> {
    const params = new URLSearchParams({ state, per_page: "100", sort: "updated", direction: "desc" });
    if (label) params.set("labels", label);
    const issues = await this.request<GitHubIssue[]>("/repos/" + this.owner + "/" + this.repo + "/issues?" + params);
    return issues.filter((issue) => !issue.pull_request);
  }

  async updateIssue(number: number, body: string, labels: string[], state: "open" | "closed"): Promise<void> {
    await this.request("/repos/" + this.owner + "/" + this.repo + "/issues/" + number, {
      method: "PATCH",
      json: { body, labels, state }
    });
  }

  async comment(number: number, body: string): Promise<void> {
    await this.request("/repos/" + this.owner + "/" + this.repo + "/issues/" + number + "/comments", {
      method: "POST",
      json: { body }
    });
  }

  async ensureLabel(name: string, color: string, description: string): Promise<void> {
    try {
      await this.request("/repos/" + this.owner + "/" + this.repo + "/labels/" + encodeURIComponent(name));
    } catch (error) {
      if ((error as Error & { status?: number }).status !== 404) throw error;
      await this.request("/repos/" + this.owner + "/" + this.repo + "/labels", {
        method: "POST",
        json: { name, color, description }
      });
    }
  }

  async ensureOperationalLabels(): Promise<void> {
    const labels = [
      ["threads:ready", "1f6feb", "Validated job waiting for publication"],
      ["threads:processing", "fbca04", "Threads job currently being processed"],
      ["threads:published", "2da44e", "Successfully published to Threads"],
      ["threads:failed", "d1242f", "Threads job requires attention"],
      ["threads:dry-run", "8250df", "Dry-run completed without publishing"]
    ] as const;
    for (const [name, color, description] of labels) await this.ensureLabel(name, color, description);
  }

  parseJob(issue: GitHubIssue): ThreadsJob {
    if (!issue.body) throw new Error("Issue body is empty");
    return parseIssueBody(issue.body);
  }

  async saveJob(number: number, job: ThreadsJob, labels: string[], state: "open" | "closed"): Promise<void> {
    await this.updateIssue(number, serializeJob(job), labels, state);
  }
}
