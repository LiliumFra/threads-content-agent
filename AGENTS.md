# Threads Content Agent — Codex entry point

Read actual source and current runtime configuration before editing. This repository prepares and publishes technology posts using jobs, GitHub Actions, Buffer and Cloudinary; it is **not** the PatitasMap outreach sender.

## Authority order
1. `README.md` for architecture, provider and supported operations.
2. `config/policy.json` for immutable runtime caps, cooldown and minimum interval.
3. `config/automation.json` and `config/growth.json` for discovery, adaptive cadence, source counts, languages, scores and provider budgets. If configuration conflicts, apply the **stricter effective restriction**, report it, and never silently increase a cap.
4. `docs/EDITORIAL_POLICY.md` and `docs/MEDIA_POLICY.md` for editorial and image reuse criteria.
5. `config/storage.json`, `jobs/pending`, `jobs/results` and `state/manual-breakouts.json` where present, for dedupe, quota and mature metrics.
6. Exact code in `src/` overrides stale explanatory documentation; fix documentation only after proving source behavior.

## Specialist skills
- `.agents/skills/threads-source-backed-editorial/SKILL.md` — research, scoring, topics, bilingual editorial and dedupe.
- `.agents/skills/threads-publishing-safety/SKILL.md` — queue/provider quotas, image-rights, job integrity and publishing verification.

## Operational constraints
- Never invent breaking news, metrics, availability, sources, endorsements or image-reuse rights. A search hit is a discovery clue, not permission to copy.
- No arbitrary bulk publishing, engagement bait, disguised ads, political content, reposting protected images or watermark removal.
- Current hard cap is defined by live `config/policy.json` (at catalog creation: 16/day), with exceptional volume above 12 requiring the documented high thresholds; volume is capacity, never a quota.
- Preserve the 60-minute immutable minimum spacing and all provider budgets. No unaudited auto-raising of quotas.
- Secrets stay in GitHub Secrets/runtime; never copy them into files, chat, logs, commits or test fixtures.
- Do not trigger or rerun GitHub Actions, publish to Threads/Buffer, change live limits or deploy without express user authorization. A saved JSON job is not a confirmed published post.
- Run only appropriate local validations when authorized; report actual evidence and never claim a run was performed when it was not.
