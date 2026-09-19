import { GitHubClient } from "../github/client.js";
import { Processor } from "../core/processor.js";
import { loadPolicy } from "../core/policy.js";

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const repository = process.env.GITHUB_REPOSITORY;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");
  if (!githubToken) throw new Error("GITHUB_TOKEN is required");

  const github = new GitHubClient(githubToken, repository, optional("GITHUB_API_URL") ?? "https://api.github.com");
  const policy = await loadPolicy(optional("POLICY_PATH") ?? "config/policy.json");
  const cloudName = optional("CLOUDINARY_CLOUD_NAME");
  const apiKey = optional("CLOUDINARY_API_KEY");
  const apiSecret = optional("CLOUDINARY_API_SECRET");
  const threadsAccessToken = optional("THREADS_ACCESS_TOKEN");
  const threadsApiHost = optional("THREADS_API_HOST");
  const cloudinaryFolder = optional("CLOUDINARY_FOLDER");

  const processor = new Processor({
    github,
    policy,
    ...(threadsAccessToken ? { threadsAccessToken } : {}),
    ...(threadsApiHost ? { threadsApiHost } : {}),
    ...(cloudName && apiKey && apiSecret ? {
      cloudinary: {
        cloudName,
        apiKey,
        apiSecret,
        ...(cloudinaryFolder ? { folder: cloudinaryFolder } : {})
      }
    } : {})
  });

  if (mode === "issue") {
    const number = Number(process.argv[3]);
    if (!Number.isInteger(number) || number <= 0) throw new Error("A positive issue number is required");
    console.log(JSON.stringify({ issue: number, result: await processor.processIssue(number) }));
    return;
  }
  if (mode === "queue") {
    console.log(JSON.stringify(await processor.processQueue(), null, 2));
    return;
  }
  if (mode === "metrics") {
    console.log(JSON.stringify(await processor.refreshMetrics(), null, 2));
    return;
  }
  throw new Error("Mode must be one of: issue, queue, metrics");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
