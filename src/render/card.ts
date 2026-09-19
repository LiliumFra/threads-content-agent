import sharp from "sharp";
import type { ThreadsJob } from "../domain/job.js";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function tspans(lines: string[], x: number, startY: number, lineHeight: number): string {
  return lines.map((line, index) => '<tspan x="' + x + '" y="' + (startY + index * lineHeight) + '">' + escapeXml(line) + "</tspan>").join("");
}

export async function renderCard(job: ThreadsJob): Promise<Buffer> {
  if (job.visual.mode !== "card") throw new Error("renderCard requires visual.mode=card");
  const headline = wrap(job.visual.headline, 23).slice(0, 4);
  const subheadline = wrap(job.visual.subheadline, 42).slice(0, 5);
  const source = job.strategy.sources[0] ? new URL(job.strategy.sources[0]).hostname.replace(/^www\./, "") : "fuente verificada";

  const svg = [
    '<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1080" height="1350" fill="#F7F4EE"/>',
    '<rect x="64" y="64" width="952" height="1222" rx="42" fill="#FFFFFF" stroke="#E7E2D8" stroke-width="2"/>',
    '<rect x="104" y="112" width="14" height="64" rx="7" fill="#FF6B57"/>',
    '<text x="146" y="156" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700" letter-spacing="3" fill="#4A4A4A">' + escapeXml(job.visual.eyebrow.toUpperCase()) + "</text>",
    '<circle cx="930" cy="144" r="34" fill="#49C7D9"/>',
    '<text x="104" y="326" font-family="Arial,Helvetica,sans-serif" font-size="88" font-weight="800" fill="#151515">' + tspans(headline, 104, 326, 102) + "</text>",
    '<line x1="104" y1="770" x2="976" y2="770" stroke="#E7E2D8" stroke-width="2"/>',
    '<text x="104" y="852" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="400" fill="#4E4E4E">' + tspans(subheadline, 104, 852, 58) + "</text>",
    '<rect x="104" y="1162" width="872" height="1" fill="#E7E2D8"/>',
    '<text x="104" y="1222" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="600" fill="#6B6B6B">Fuente: ' + escapeXml(source) + "</text>",
    '<text x="976" y="1222" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="#151515">THREADS BRIEF</text>',
    "</svg>"
  ].join("");

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
