import { createHash } from "node:crypto";
import { z } from "zod";

const metricsSchema = z.object({
  views: z.number().nonnegative().optional(),
  impressions: z.number().nonnegative().optional(),
  reach: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  replies: z.number().nonnegative().optional(),
  reposts: z.number().nonnegative().optional(),
  quotes: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  engagement_rate: z.number().nonnegative().optional()
});

const resultSchema = z.object({
  status: z.enum(["PUBLISHED", "DRY_RUN", "FAILED", "REVIEW"]),
  published_at: z.string().optional(),
  provider: z.enum(["buffer", "threads"]).optional(),
  provider_post_id: z.string().min(1).optional(),
  thread_id: z.string().min(1).optional(),
  external_url: z.string().url().optional(),
  content_hash: z.string().length(64),
  media_url: z.string().url().optional(),
  media_urls: z.array(z.string().url()).max(20).optional(),
  metrics: metricsSchema.optional(),
  provider_metrics: z.record(z.string(), z.number()).optional(),
  metrics_updated_at: z.string().optional(),
  error: z.string().max(2000).optional()
});


const sourceMediaSchema = z.object({
  kind: z.literal("news_image").default("news_image"),
  image_url: z.string().url(),
  source_url: z.string().url(),
  credit: z.string().min(1).max(240),
  rights: z.enum([
    "official_press_asset",
    "licensed_reusable",
    "public_domain",
    "permission_granted",
    "reference_only"
  ]),
  retrieved_at: z.string().datetime({ offset: true }),
  publishable: z.boolean().default(false)
});

const visualSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.literal("card"),
    headline: z.string().min(1).max(110),
    subheadline: z.string().min(1).max(260),
    eyebrow: z.string().min(1).max(36).default("TECNOLOGÍA"),
    alt_text: z.string().min(1).max(500)
  })
]);

const contentTypeSchema = z.enum([
  "breaking_news",
  "explainer",
  "discussion",
  "data",
  "light"
]);

export const jobSchema = z.object({
  schema_version: z.literal(1),
  status: z.enum(["READY", "PUBLISHED", "FAILED", "DRY_RUN", "REVIEW"]).default("READY"),
  publish_at: z.string().datetime({ offset: true }),
  action: z.enum(["post", "reply", "quote"]).default("post"),
  relation_id: z.string().min(1).optional(),
  topic: z.string().min(2).max(80),
  language: z.string().min(2).max(12).default("es"),
  content: z.object({
    text: z.string().min(1).max(500),
    topic_tag: z.string().min(1).max(50).optional(),
    reply_control: z.string().min(1).max(50).optional()
  }),
  visual: visualSchema.default({ mode: "none" }),
  source_media: sourceMediaSchema.optional(),
  strategy: z.object({
    hook_style: z.string().min(1).max(50),
    goal: z.string().min(1).max(50),
    content_type: contentTypeSchema.optional(),
    candidate_score: z.number().min(0).max(100).optional(),
    breaking_news: z.boolean().optional(),
    score_breakdown: z.record(z.string(), z.number().min(0).max(100)).optional(),
    sources: z.array(z.string().url()).min(1).max(8)
  }),
  dry_run: z.boolean().default(true),
  result: resultSchema.optional()
}).superRefine((job, ctx) => {
  if (job.source_media?.publishable && job.source_media.rights === "reference_only") {
    ctx.addIssue({
      code: "custom",
      path: ["source_media", "publishable"],
      message: "reference_only source media cannot be marked publishable"
    });
  }
  if ((job.action === "reply" || job.action === "quote") && !job.relation_id) {
    ctx.addIssue({
      code: "custom",
      path: ["relation_id"],
      message: "relation_id is required for replies and quote posts"
    });
  }
});

export type ThreadsJob = z.infer<typeof jobSchema>;
export type ThreadsMetrics = z.infer<typeof metricsSchema>;

export function parseIssueBody(body: string): ThreadsJob {
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Issue body does not contain a JSON object");
  return jobSchema.parse(JSON.parse(body.slice(first, last + 1)));
}

export function serializeJob(job: ThreadsJob): string {
  return "~~~json\n" + JSON.stringify(job, null, 2) + "\n~~~\n";
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function contentHash(job: ThreadsJob): string {
  const visual = job.visual.mode === "card"
    ? [job.visual.headline, job.visual.subheadline, job.visual.eyebrow].map(normalize).join("|")
    : "none";
  const canonical = [
    job.action,
    job.relation_id ?? "",
    normalize(job.topic),
    normalize(job.content.text),
    normalize(job.content.topic_tag ?? ""),
    visual
  ].join("::");
  return createHash("sha256").update(canonical).digest("hex");
}
