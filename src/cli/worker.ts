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
  const rawPublishProvider = optional("PUBLISH_PROVIDER");
  let publishProvider: "buffer" | "threads" | undefined;
  if (rawPublishProvider) {
    if (rawPublishProvider !== "buffer" && rawPublishProvider !== "threads") {
      throw new Error("PUBLISH_PROVIDER must be buffer or threads");
    }
    publishProvider = rawPublishProvider;
  }
  const bufferApiKey = optional("BUFFER_API_KEY");
  const bufferChannelId = optional("BUFFER_CHANNEL_ID");
  const bufferOrganizationId = optional("BUFFER_ORGANIZATION_ID");
  const bufferApiHost = optional("BUFFER_API_HOST");
  const threadsAccessToken = optional("THREADS_ACCESS_TOKEN");
  const threadsApiHost = optional("THREADS_API_HOST");
  const cloudinaryFolder = optional("CLOUDINARY_FOLDER");

  const processor = new FileProcessor({
    policy,
    ...(publishProvider ? { publishProvider } : {}),
    ...(bufferApiKey ? { bufferApiKey } : {}),
    ...(bufferChannelId ? { bufferChannelId } : {}),
    ...(bufferOrganizationId ? { bufferOrganizationId } : {}),
    ...(bufferApiHost ? { bufferApiHost } : {}),
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
  if (mode === "health") {
    console.log(JSON.stringify(await processor.healthCheck(), null, 2));
    return;
  }
  throw new Error("Mode must be one of: file, queue, metrics, health");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
