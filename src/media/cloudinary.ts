import { createHash } from "node:crypto";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
};

export async function uploadPng(png: Buffer, publicId: string, config: CloudinaryConfig): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = config.folder ?? "threads-content-agent";
  const signed = ["folder=" + folder, "public_id=" + publicId, "timestamp=" + timestamp].sort().join("&");
  const signature = createHash("sha1").update(signed + config.apiSecret).digest("hex");

  const arrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  const form = new FormData();
  form.set("file", new Blob([arrayBuffer], { type: "image/png" }), publicId + ".png");
  form.set("api_key", config.apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("signature", signature);

  const response = await fetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudName) + "/image/upload", {
    method: "POST",
    body: form
  });
  if (!response.ok) throw new Error("Cloudinary upload failed: " + response.status + " " + await response.text());
  const data = await response.json() as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary response did not contain secure_url");
  return data.secure_url;
}

export async function uploadRemoteImage(imageUrl: string, publicId: string, config: CloudinaryConfig): Promise<string> {
  const parsed = new URL(imageUrl);
  if (parsed.protocol !== "https:") throw new Error("Source media URL must use HTTPS");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = config.folder ?? "threads-content-agent";
  const signed = ["folder=" + folder, "public_id=" + publicId, "timestamp=" + timestamp].sort().join("&");
  const signature = createHash("sha1").update(signed + config.apiSecret).digest("hex");

  const form = new FormData();
  form.set("file", imageUrl);
  form.set("api_key", config.apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("signature", signature);

  const response = await fetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudName) + "/image/upload", {
    method: "POST",
    body: form
  });
  if (!response.ok) throw new Error("Cloudinary remote image upload failed: " + response.status + " " + await response.text());
  const data = await response.json() as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary response did not contain secure_url");
  return data.secure_url;
}
