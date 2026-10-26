import sharp from "sharp";
import { createHash } from "node:crypto";
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

/** Never silently truncate a factual headline or deadline on a public card. */
function wrapForCard(text: string, limits: number[], maxLines: number, field: string): { lines: string[]; level: number } {
  for (let level = 0; level < limits.length; level++) {
    const limit = limits[level]!;
    const lines = wrap(text, limit);
    if (lines.length <= maxLines && lines.every((line) => line.length <= limit)) {
      return { lines, level };
    }
  }
  throw new Error("Card " + field + " cannot fit legibly; shorten copy rather than clipping verified facts");
}

function tspans(lines: string[], x: number, startY: number, lineHeight: number): string {
  return lines.map((line, index) =>
    '<tspan x="' + x + '" y="' + (startY + index * lineHeight) + '">' + escapeXml(line) + "</tspan>"
  ).join("");
}

function palette(seed: string): { a: string; b: string; c: string } {
  const palettes = [
    { a: "#7C3AED", b: "#22D3EE", c: "#F472B6" },
    { a: "#2563EB", b: "#06B6D4", c: "#A3E635" },
    { a: "#DC2626", b: "#F59E0B", c: "#8B5CF6" },
    { a: "#0F766E", b: "#38BDF8", c: "#E879F9" },
    { a: "#4F46E5", b: "#14B8A6", c: "#F97316" }
  ];
  const digest = createHash("sha256").update(seed).digest();
  return palettes[digest[0]! % palettes.length]!;
}

export async function renderCard(job: ThreadsJob): Promise<Buffer> {
  if (job.visual.mode !== "card") throw new Error("renderCard requires visual.mode=card");

  const headlineLayout = wrapForCard(job.visual.headline, [20, 23, 26, 30], 4, "headline");
  const subheadlineLayout = wrapForCard(job.visual.subheadline, [38, 42, 46, 50], 4, "subheadline");
  const headline = headlineLayout.lines;
  const subheadline = subheadlineLayout.lines;
  const headlineFont = [86, 76, 65, 57][headlineLayout.level]!;
  const subheadlineFont = [39, 36, 33, 30][subheadlineLayout.level]!;
  const source = job.strategy.sources[0]
    ? new URL(job.strategy.sources[0]).hostname.replace(/^www\./, "")
    : "fuente verificada";
  const topic = job.content.topic_tag ?? job.visual.eyebrow;
  const p = palette(job.topic + topic);

  const svg = [
    '<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">',
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1080" y2="1350" gradientUnits="userSpaceOnUse">',
    '<stop stop-color="#090B13"/><stop offset="0.52" stop-color="#101827"/><stop offset="1" stop-color="#070A10"/>',
    '</linearGradient>',
    '<radialGradient id="orbA"><stop stop-color="' + p.a + '" stop-opacity=".95"/><stop offset="1" stop-color="' + p.a + '" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="orbB"><stop stop-color="' + p.b + '" stop-opacity=".8"/><stop offset="1" stop-color="' + p.b + '" stop-opacity="0"/></radialGradient>',
    '<filter id="blur"><feGaussianBlur stdDeviation="48"/></filter>',
    '<filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="26" flood-opacity=".42"/></filter>',
    '<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".045" stroke-width="1"/></pattern>',
    '</defs>',
    '<rect width="1080" height="1350" fill="url(#bg)"/>',
    '<rect width="1080" height="1350" fill="url(#grid)"/>',
    '<circle cx="865" cy="225" r="270" fill="url(#orbA)" filter="url(#blur)"/>',
    '<circle cx="145" cy="1120" r="330" fill="url(#orbB)" filter="url(#blur)"/>',
    '<path d="M770 105 C870 48 970 84 1008 176 C1048 272 988 358 886 352 C790 346 716 266 736 178 Z" fill="none" stroke="' + p.c + '" stroke-opacity=".55" stroke-width="3"/>',
    '<path d="M786 130 C870 80 952 110 984 184 C1017 260 970 326 888 320 C808 315 748 251 765 183 Z" fill="none" stroke="#FFFFFF" stroke-opacity=".16" stroke-width="2"/>',

    '<g filter="url(#shadow)">',
    '<rect x="66" y="68" width="948" height="1214" rx="52" fill="#0D1220" fill-opacity=".82" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="2"/>',
    '</g>',

    '<rect x="108" y="112" width="268" height="58" rx="29" fill="' + p.a + '" fill-opacity=".18" stroke="' + p.a + '" stroke-opacity=".75"/>',
    '<circle cx="141" cy="141" r="7" fill="' + p.b + '"/>',
    '<text x="162" y="151" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" letter-spacing="2.1" fill="#F8FAFC">' + escapeXml(job.visual.eyebrow.toUpperCase()) + '</text>',

    '<text x="108" y="316" font-family="Arial,Helvetica,sans-serif" font-size="' + headlineFont + '" font-weight="900" fill="#F8FAFC" letter-spacing="-2.2">' + tspans(headline, 108, 316, 96) + '</text>',

    '<g opacity=".95">',
    '<circle cx="856" cy="672" r="96" fill="' + p.a + '" fill-opacity=".13" stroke="' + p.a + '" stroke-width="2"/>',
    '<circle cx="856" cy="672" r="54" fill="' + p.b + '" fill-opacity=".18" stroke="' + p.b + '" stroke-width="2"/>',
    '<circle cx="856" cy="672" r="13" fill="#FFFFFF"/>',
    '<path d="M742 632 L800 655 M742 710 L800 687 M914 655 L972 632 M914 687 L972 710" stroke="' + p.c + '" stroke-width="4" stroke-linecap="round"/>',
    '<circle cx="732" cy="628" r="12" fill="' + p.c + '"/><circle cx="982" cy="628" r="12" fill="' + p.c + '"/>',
    '<circle cx="732" cy="714" r="12" fill="' + p.b + '"/><circle cx="982" cy="714" r="12" fill="' + p.b + '"/>',
    '</g>',

    '<line x1="108" y1="770" x2="972" y2="770" stroke="#FFFFFF" stroke-opacity=".13"/>',
    '<text x="108" y="842" font-family="Arial,Helvetica,sans-serif" font-size="' + subheadlineFont + '" font-weight="500" fill="#CBD5E1">' + tspans(subheadline, 108, 842, 55) + '</text>',

    '<rect x="108" y="1094" width="420" height="64" rx="18" fill="#FFFFFF" fill-opacity=".07" stroke="#FFFFFF" stroke-opacity=".1"/>',
    '<text x="134" y="1136" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700" fill="#E2E8F0">TEMA · ' + escapeXml(topic) + '</text>',

    '<line x1="108" y1="1194" x2="972" y2="1194" stroke="#FFFFFF" stroke-opacity=".11"/>',
    '<text x="108" y="1244" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="600" fill="#94A3B8">Fuente: ' + escapeXml(source) + '</text>',
    '<text x="972" y="1244" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" letter-spacing="1.2" fill="#F8FAFC">THREADS BRIEF</text>',
    '</svg>'
  ].join("");

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
