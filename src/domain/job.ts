import { createHash } from "node:crypto";
import { z } from "zod";

const metricsSchema = z.object({
  views: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  replies: z.number().nonnegative().optional(),
  reposts: z.number().nonnegative().optional(),
  quotes: z.number().nonnegative().optional()
});

const resultSchema = z.object({
  status: z.enum(["PUBLISHED", "DRY_RUN", "FAILED"]),
  published_at: z.string().optional(),
  thread_id: z.string().min(1).optional(),
  content_hash: z.string().length(64),
  media_url: z.string().url().optional(),
  metrics: metricsSchema.optional(),
  metrics_updated_at: z.string().optional(),
  error: z.string().max(2000).optional()
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

export const jobSchema = z.object({
  schema_version: z.literal(1),
  status: z.enum(["READY", "PUBLISHED", "FAILED", "DRY_RUN"]).default("READY"),
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
  strategy: z.object({
    hook_style: z.string().min(1).max(50),
    goal: z.string().min(1).max(50),
    sources: z.array(z.string().url()).min(1).max(8)
  }),
  dry_run: z.boolean().default(true),
  result: resultSchema.optional()
}).superRefine((job, ctx) => {
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
