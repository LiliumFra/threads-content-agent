import { FileProcessor } from "../core/file-processor.js";
import { loadPolicy } from "../core/policy.js";

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const policy = await loadPolicy(optional("POLICY_PATH") ?? "config/policy.json");
  const cloudName = optional("CLOUDINARY_CLOUD_NAME");
  const apiKey = optional("CLOUDINARY_API_KEY");
  const apiSecret = optional("CLOUDINARY_API_SECRET");
  const threadsAccessToken = optional("THREADS_ACCESS_TOKEN");
  const threadsApiHost = optional("THREADS_API_HOST");
  const cloudinaryFolder = optional("CLOUDINARY_FOLDER");

  const processor = new FileProcessor({
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

  if (mode === "file") {
    const path = process.argv[3];
    if (!path) throw new Error("A pending job path is required");
    console.log(JSON.stringify({ path, result: await processor.processFile(path) }));
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
  throw new Error("Mode must be one of: file, queue, metrics");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
