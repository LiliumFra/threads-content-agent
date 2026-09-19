import { uploadPng } from "../media/cloudinary.js";
import { renderCard } from "../render/card.js";
import type { ThreadsJob } from "../domain/job.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

async function main(): Promise<void> {
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const apiSecret = required("CLOUDINARY_API_SECRET");
  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "threads-content-agent";

  const job: ThreadsJob = {
    schema_version: 1,
    status: "READY",
    publish_at: new Date().toISOString(),
    action: "post",
    topic: "cloudinary-health",
    language: "es",
    content: {
      text: "Prueba interna de medios. No debe publicarse."
    },
    visual: {
      mode: "card",
      headline: "Cloudinary listo",
      subheadline: "Prueba privada del pipeline de imágenes. Esta imagen no se publica en Threads.",
      eyebrow: "MEDIA CHECK",
      alt_text: "Tarjeta de prueba interna para verificar la subida de imágenes a Cloudinary."
    },
    strategy: {
      hook_style: "diagnostic",
      goal: "validation",
      sources: ["https://cloudinary.com/"]
    },
    dry_run: true
  };

  const png = await renderCard(job);
  const suffix = Date.now().toString(36);
  const url = await uploadPng(
    png,
    "health-" + suffix,
    { cloudName, apiKey, apiSecret, folder }
  );

  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Cloudinary did not return an HTTPS URL");
  }

  console.log(JSON.stringify({
    provider: "cloudinary",
    status: "ok",
    host: parsed.hostname,
    folder,
    public_url: url
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
