---
name: threads-source-backed-editorial
description: Research, fact-check, score and prepare safe original tech-news posts for the LiliumFra/threads-content-agent bilingual Threads publishing pipeline. Use for trend research, source verification, native topic selection, novelty scoring and editorial QA.
---
# Threads source-backed editorial

## Prerequisites
Read `AGENTS.md`, `config/automation.json`, `config/growth.json`, `config/policy.json`, `docs/EDITORIAL_POLICY.md`, `docs/EDITORIAL_EXECUTION_PLAYBOOK.md` and current `jobs/pending`/`jobs/results` before proposing production jobs. Prefer source/config over copied historical thresholds.

## Procedure
1. Identify genuinely recent nonpolitical technology news within the configured freshness window. Verify each material factual claim against at least the configured number of independent credible sources, preferably a primary authority plus professional reporting. Do not use recycled Threads posts as factual evidence.
2. Score each candidate against the seven weighted dimensions in the live automation config. For normal posts, enforce min_trend_score; for breaking publication, enforce the stricter configured cutoff. If uncertain, reject instead of filling a daily quota.
3. Check same event/angle across pending and results, cross-language duplicate risk, and native topic cooldown. A high-view benchmark only supports a hypothesis, not copied text or a volume increase.
4. Match one relevant live/evergreen native Threads topic when genuinely supported: exact specific > useful evergreen > broadly relevant > none; never choose a trending unrelated topic.
5. Draft in the authorized language: neutral Spanish by default, English only within effective language policy. No machine-like literal replay of an existing Spanish post in English. <=500 characters, precise factual hook, useful context and a real discussion question when justified.
6. Produce the smallest valid job payload accepted by the repository's actual schema; include verified source URLs, claim provenance, score breakdown, locale, novelty, topic and appropriate visual specification. Do not guess JSON fields; inspect `src/` validators and example jobs.
7. Treat generated editorial card as default. Use external media only after `threads-publishing-safety` rights checks. A real image is optional, never a prerequisite to accurate content.
8. Do not enqueue or publish when caps, min interval, quota, permissions or policy are not verified. Deliver a held candidate with exact reasons.

## Output
Verified story, source dates/URLs, novelty/dedupe decision, configured score calculation, target language/topic, acceptable visual rights, eligible slot, proposed job path, and publisher confirmation only if actual downstream result IDs exist.

## Editorial quality gates (2026-10-21)

Apply the detailed claim-ledger, style-variation and learning rules in `docs/EDITORIAL_POLICY.md` before drafting any production job. These gates refine content quality only; they do not modify runtime policy, job schema, schedules or provider budgets.

1. **Central-claim verification:** Require >=2 reliable claim-relevant source URLs and identify what each actually proves. A manufacturer spec sheet does not corroborate a separate order claim; an unrelated Reuters company report does not substantiate a product announcement. Hold or narrow unsupported stories. Distinguish company claims from independently tested outcomes.
2. **No invented momentum:** Seven score_breakdown keys must match exactly the seven weighted dimensions in `config/automation.json`, each within its configured maximum; their sum equals candidate_score. Give discussion_velocity **0** in the absence of real timed conversation evidence. Do not pad source_quality because two URLs exist.
3. **Audience utility first:** Choose one concrete consequence or decision for the target reader. Rotate supported opening styles (user impact, numeric contrast, security action, developer utility, evidence check), based on the last ten confirmed sent posts. Avoid repeating formulaic broad closing questions: a specific informed question is optional, not required.
4. **Format selection:** Use schema-supported card only when it conveys additional verified context (scope, number, comparison, eligibility); otherwise use intentional text-only mode. No imaginary native carousel or video feature. Describe images with alt text, honor rights and quotas.
5. **Safe learning:** Classify mature provider-sent metrics as distribution, engagement, conversation and conversion. Use >=24h maturity; 0-view denominator => unavailable ratio. Wait for >=20 matched mature posts per segment before changing guidance; never infer a guaranteed lift or automatically increase frequency.
6. **Human conversation:** Where comments exist, identify substantiated reply opportunities for a person to review; never invent an automated replies integration. Preserve exact existing publish windows, dedupe, topic cooldown, spacing, daily caps and delivery confirmation.

Reference research: https://buffer.com/resources/state-of-social-media-engagement-2026/ ; https://buffer.com/resources/threads-comments-engagement/ ; https://buffer.com/resources/the-best-time-to-post-on-threads/ ; https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/

## Active-window throughput and media calibration (2026-10-23)

Apply `config/growth.json.editorial_execution` and the operating playbook while leaving all configured safety limits intact.

1. During a normal eligible window, do not stop after one generic discovery query: scan 3–4 independent lanes, deep-verify the two most promising **different events**, and consider the second if the first fails. Off-hours are reserved for bounded >=90 breaking checks and delivery reconciliation.
2. Prefer audience-local high-engagement morning periods *within existing windows*, using each target's real timezone and DST. The hourly scanner's HH:11 is not a precise scheduled posting hour; due-now only, no scheduled READY backlog or CI skip markers on publication commits.
3. For deadline, product availability, device eligibility, numeric comparison or patch-action stories, try to create a genuinely informative `card` with accessible alt text, accurate short headline and complementary subheadline. `none` is deliberate when nuance/conversation is better or verified media headroom is unavailable, not an automatic low-effort default.
4. Target useful original content, not a higher count at any cost: strong single factual claim; what changes, who is affected, what action follows, and necessary limitations. Use a relevant native topic and vary framing against the last ten confirmed-sent posts.
5. Never claim a publication from `status=PUBLISHED` alone. Count only provider `sent` plus post ID; use metrics snapshots collected >=24 hours after delivery and >=20 comparable posts per segment for adaptive timing/format decisions.

## Screenshot-based hypotheses and event identity (2026-10-25)

Read `docs/THREADS_SCREENSHOT_PERFORMANCE_AUDIT_2026-10-25.md` and `state/manual-breakouts.json` as manual, descriptive observations. Do **not** equate screen views of different ages with comparable mature Buffer metrics. The exceptional One UI 9 (8.1K views) and PHP security alert (1.1K) motivate hypothesis testing for immediate utility, real release scope, compatibility and security mitigation; they do not justify automatic boosts to the configured score or changing publish hours.

For every *new* production news story, add `strategy.event_key`: lowercase ASCII hyphen slug identifying entity + product/version + exact dated announcement. An alternate angle or EN translation of the same announcement must retain that key; a materially new follow-up gets a new key only if independently sourced. Screen and results history show near-repeated Googlebook stories, so event-level dedupe is more reliable than copy hashes alone. Check all pending and result statuses, even where old jobs have no key. Do not invent a key solely to evade a duplicate.

Run a mobile-card readability check: concise headline, useful complementary subheadline, all claims preserved without clipping, clear alt text, and current Cloudinary credit headroom. If fitting fails, shorten editorial copy without losing the precise fact before enqueuing; never rely on the renderer to discard extra lines. The image/no-image choice must be intentional and evidence-led.

If a post receives real replies, flag substantive questions for human responses; do not automate generic comments or infer that zero replies is equivalent to zero discovery. A Buffer study associates replies with higher engagement, but correlation does not establish causation and current worker does not support an automatic conversational agent.
