---
name: threads-source-backed-editorial
description: Research, fact-check, score and prepare safe original tech-news posts for the LiliumFra/threads-content-agent bilingual Threads publishing pipeline. Use for trend research, source verification, native topic selection, novelty scoring and editorial QA.
---
# Threads source-backed editorial

## Prerequisites
Read `AGENTS.md`, `config/automation.json`, `config/growth.json`, `config/policy.json`, `docs/EDITORIAL_POLICY.md` and current `jobs/pending`/`jobs/results` before proposing production jobs. Prefer source/config over copied historical thresholds.

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
