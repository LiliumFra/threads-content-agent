---
name: threads-publishing-safety
description: Audit or implement safe queueing and release controls for LiliumFra/threads-content-agent using Buffer, Cloudinary and GitHub Actions. Use when planning publication, deduplicating jobs, checking free-tier budgets, visual rights or validating post results.
---
# Threads publishing safety

## Authorities
Inspect `config/policy.json`, `config/automation.json`, `config/growth.json`, `config/storage.json`, `docs/MEDIA_POLICY.md`, `docs/BUFFER_SETUP.md`, runtime code and the current pending/results state. Do not assume README prose is fresher than executable configuration.

## Checks before enqueue
- Publisher enabled and live mode verified. Count *pending + already published* in the policy calendar day; respect the smallest effective hard cap. At skill creation this is 16/day, not an automatic target. Posts 13–16 require >=94 independently verified exceptional/breaking coverage, unless stricter policy applies.
- Confirm configured 60-minute minimum spacing, topic cooldown, native topic daily cap, account timezone, language windows, per-scan and provider budgets. Do not fabricate send windows or relax immutable limits.
- Check JSON job identity/hash against pending and result history, cross-language equivalents, already published Buffer/Threads IDs where available and cooldowns. No repeated publish on ambiguous results.
- Source media: official press asset, explicit licensed reuse, public domain or clear written permission. Preserve URL, photographer, license/terms, rights_checked_at and attribution. Credits alone do **not** grant rights. Unknown => reference_only and original editorial card; no hotlinking, watermark removal or binary files in Git.
- Use Cloudinary only when runtime media budget and authorized credentials are present. Never reveal keys or log tokens.
- If no rights-resolved image, retain source references and publish only the original generated card when authorized.

## Outcomes
- Creating a JSON job or a Git commit is **not** posting. Only downstream provider response / persisted `jobs/results` supported by an actual Buffer/Threads ID establishes a published result.
- Ambiguous upload or publishing timeout => reconcile provider state before any retry; no blind duplicate posting.
- Do not trigger Actions, push production jobs, post, deploy, change limits or invoke provider APIs absent current explicit user authorization.
- For reviews, report exact caps, pending/published counts, source and rights evidence, budget, status, failures and next action. Unknown stays UNKNOWN.
