import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type Any = Record<string, any>;
const growthPath = "config/growth.json";
const policyPath = "config/policy.json";
const resultsDir = "jobs/results";
const manualBreakoutsPath = "state/manual-breakouts.json";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
};
const metric = (j: Any, k: string) => Number(j?.result?.metrics?.[k] ?? 0);
const score = (j: Any) =>
  metric(j, "replies") * 4 +
  metric(j, "reposts") * 3 +
  metric(j, "quotes") * 3 +
  metric(j, "shares") * 2 +
  metric(j, "likes") * 0.25 +
  metric(j, "engagement_rate") * 100 +
  Math.log10(1 + metric(j, "views"));

async function loadJobs() {
  const fs = (await readdir(resultsDir)).filter((x) => x.endsWith(".json"));
  const out: Any[] = [];
  for (const file of fs) {
    try {
      out.push(JSON.parse(await readFile(join(resultsDir, file), "utf8")));
    } catch {}
  }
  return out.sort(
    (a, b) => Date.parse(a?.result?.published_at ?? "1970-01-01") - Date.parse(b?.result?.published_at ?? "1970-01-01")
  );
}

async function loadManualBreakouts() {
  try {
    const payload = JSON.parse(await readFile(manualBreakoutsPath, "utf8"));
    return Array.isArray(payload?.signals) ? payload.signals : [];
  } catch {
    return [];
  }
}

function breakoutDiagnostics(jobs: Any[], multiplier = 3) {
  const views = jobs.map((j) => metric(j, "views")).filter((v) => v > 0);
  const medianViews = median(views);
  const threshold = medianViews > 0 ? medianViews * multiplier : 0;
  return {
    median_views: medianViews,
    threshold,
    posts: jobs
      .filter((j) => threshold > 0 && metric(j, "views") >= threshold)
      .map((j) => ({
        topic: j.topic,
        language: j.language,
        views: metric(j, "views"),
        replies: metric(j, "replies"),
        reposts: metric(j, "reposts"),
        quotes: metric(j, "quotes"),
        likes: metric(j, "likes"),
        classification:
          metric(j, "replies") === 0
            ? "distribution_breakout"
            : "distribution_and_conversation_breakout"
      }))
  };
}

function languageDiagnostics(jobs: Any[]) {
  const languages = [...new Set(jobs.map((j) => String(j.language ?? "unknown")))];
  return Object.fromEntries(
    languages.map((language) => {
      const segment = jobs.filter((j) => String(j.language ?? "unknown") === language);
      return [language, {
        posts: segment.length,
        median_score: median(segment.map(score)),
        median_views: median(segment.map((j) => metric(j, "views"))),
        median_replies: median(segment.map((j) => metric(j, "replies")))
      }];
    })
  );
}

export async function adaptiveTune() {
  const g = JSON.parse(await readFile(growthPath, "utf8"));
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const c = g.adaptive_control;
  if (!c?.enabled) return { status: "disabled" };

  const manualBreakouts = await loadManualBreakouts();
  const jobs = (await loadJobs()).filter(
    (j) => j.status === "PUBLISHED" && j.result?.metrics && j.result?.published_at
  );
  const now = Date.now();
  const mature = jobs.filter(
    (j) => now - Date.parse(j.result.published_at) >= c.metrics_maturity_hours * 3_600_000
  );

  if (mature.length < c.minimum_published_posts_before_tuning) {
    return {
      status: "insufficient_sample",
      mature: mature.length,
      required: c.minimum_published_posts_before_tuning,
      by_language: languageDiagnostics(mature),
      breakouts: breakoutDiagnostics(mature, g.performance_learning?.breakout_learning?.breakout_view_multiplier_vs_median ?? 3),
      manual_breakout_signals: manualBreakouts
    };
  }

  await mkdir("state", { recursive: true });
  let history: Any[] = [];
  try {
    history = (await readFile(c.audit_log_path, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {}

  const last = history.at(-1);
  if (last && now - Date.parse(last.timestamp) < c.change_cooldown_hours * 3_600_000) {
    return { status: "cooldown", by_language: languageDiagnostics(mature), breakouts: breakoutDiagnostics(mature, g.performance_learning?.breakout_learning?.breakout_view_multiplier_vs_median ?? 3), manual_breakout_signals: manualBreakouts };
  }

  const recentSize = Math.min(10, mature.length);
  const recent = mature.slice(-recentSize);
  const prior = mature.slice(0, -recentSize);
  if (prior.length < c.minimum_posts_per_segment) {
    return { status: "insufficient_baseline", by_language: languageDiagnostics(mature), breakouts: breakoutDiagnostics(mature, g.performance_learning?.breakout_learning?.breakout_view_multiplier_vs_median ?? 3), manual_breakout_signals: manualBreakouts };
  }

  const recentMedian = median(recent.map(score));
  const baselineMedian = median(prior.map(score));
  const ratio = baselineMedian > 0 ? recentMedian / baselineMedian : 1;
  const changes: Any[] = [];
  const set = (path: string, oldValue: number, nextValue: number) => {
    if (oldValue !== nextValue && changes.length < c.max_parameter_changes_per_cycle) {
      changes.push({ path, previous: oldValue, next: nextValue });
    }
  };

  const targetCfg = c.tunable_parameters.target_posts_per_day;
  const softCfg = c.tunable_parameters.soft_max_posts_per_day;
  const hardCap = Number(policy.max_posts_per_day ?? g.cadence.hard_max_posts_per_day);

  if (ratio >= 1.15) {
    set(
      "cadence.target_posts_per_day",
      g.cadence.target_posts_per_day,
      clamp(g.cadence.target_posts_per_day + targetCfg.max_step, targetCfg.min, Math.min(targetCfg.max, hardCap))
    );
    set(
      "cadence.soft_max_posts_per_day",
      g.cadence.soft_max_posts_per_day,
      clamp(g.cadence.soft_max_posts_per_day + softCfg.max_step, softCfg.min, Math.min(softCfg.max, hardCap))
    );
  }

  if (ratio <= 0.85) {
    set(
      "cadence.target_posts_per_day",
      g.cadence.target_posts_per_day,
      clamp(g.cadence.target_posts_per_day - targetCfg.max_step, targetCfg.min, Math.min(targetCfg.max, hardCap))
    );
    const thresholdCfg = c.tunable_parameters.strong_incremental_threshold;
    const currentThreshold = g.cadence.dynamic_quality_thresholds[1].minimum_score;
    set(
      "cadence.dynamic_quality_thresholds[1].minimum_score",
      currentThreshold,
      clamp(currentThreshold + thresholdCfg.max_step, thresholdCfg.min, thresholdCfg.max)
    );
    const spacingCfg = c.tunable_parameters.batch_spacing_minutes;
    set(
      "cadence.standard_spacing_minutes",
      g.cadence.standard_spacing_minutes,
      clamp(g.cadence.standard_spacing_minutes + spacingCfg.max_step, spacingCfg.min, spacingCfg.max)
    );
  }

  const diagnostics = languageDiagnostics(mature);
  const breakoutReport = breakoutDiagnostics(mature, g.performance_learning?.breakout_learning?.breakout_view_multiplier_vs_median ?? 3);
  if (!changes.length) return { status: "stable", ratio, by_language: diagnostics, breakouts: breakoutReport, manual_breakout_signals: manualBreakouts };

  for (const change of changes) {
    if (change.path === "cadence.target_posts_per_day") {
      g.cadence.target_posts_per_day = change.next;
    } else if (change.path === "cadence.soft_max_posts_per_day") {
      g.cadence.soft_max_posts_per_day = change.next;
    } else if (change.path.includes("dynamic_quality")) {
      g.cadence.dynamic_quality_thresholds[1].minimum_score = change.next;
    } else if (change.path === "cadence.standard_spacing_minutes") {
      g.cadence.standard_spacing_minutes = change.next;
    }
  }

  await writeFile(growthPath, JSON.stringify(g, null, 2) + "\n");
  const event = {
    schema_version: 2,
    controller_version: "adaptive-v2",
    timestamp: new Date().toISOString(),
    ratio,
    baseline_median: baselineMedian,
    recent_median: recentMedian,
    mature_posts: mature.length,
    by_language: diagnostics,
    breakouts: breakoutReport,
    manual_breakout_signals: manualBreakouts,
    changes,
    reason: "bounded mature-metrics auto-tuning with conversation-first score"
  };
  await writeFile(c.audit_log_path, JSON.stringify(event) + "\n", { flag: "a" });
  return { status: "tuned", ...event };
}
