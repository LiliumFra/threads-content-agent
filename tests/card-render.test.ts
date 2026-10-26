import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderCard } from "../src/render/card.js";
import type { ThreadsJob } from "../src/domain/job.js";

function card(headline: string, subheadline: string): ThreadsJob {
  return {
    schema_version: 1,
    status: "READY",
    action: "post",
    topic: "software",
    language: "es",
    publish_at: "2026-10-25T09:11:00-03:00",
    content: { text: "Texto factual verificado", topic_tag: "Software" },
    visual: { mode: "card", headline, subheadline, eyebrow: "TECNOLOGÍA", alt_text: "Tarjeta informativa en español" },
    strategy: { hook_style: "utility", goal: "inform", sources: ["https://example.com/official"] },
    dry_run: true
  };
}
describe("editorial card quality", () => {
  it("renders complete compact editorial cards to 1080 x 1350", async () => {
    const bytes = await renderCard(card(
      "Una actualización importante para Android",
      "Consulta los equipos compatibles y la fecha oficial del despliegue"
    ));
    const metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
    expect(metadata.format).toBe("png");
  });
  it("refuses to silently clip exceptionally long unbreakable words", async () => {
    await expect(renderCard(card("X".repeat(38), "Subtítulo verificable"))).rejects.toThrow("cannot fit legibly");
  });
  it("refuses to drop the second half of an excessively long subheadline", async () => {
    await expect(renderCard(card(
      "Aviso de seguridad",
      "Un subtítulo extensísimo que repite muchas explicaciones sin aportar nada y que debe ser rechazado antes de publicarse en lugar de cortar silenciosamente su información central. ".repeat(2)
    ))).rejects.toThrow("cannot fit legibly");
  });
});
