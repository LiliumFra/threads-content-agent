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

## Hourly editorial execution — avoid false empty scans

The hourly ChatGPT task is the **discovery controller**; queue.yml only processes JSON already committed. A successful empty-queue Action does not indicate a publication attempt. Do not confuse the six-hour queue recovery cron with an hourly news scout.

During a permitted audience window, if `jobs/pending` is empty and no provider incident exists, check **2–4 distinct, recent topic lanes** (at least AI/models, Android/consumer software, chips/robotics or security, adjusted to the latest 18-hour topic history). Start with a primary release/changelog or technical source and independently verify the best candidate with reputable reporting; e.g. official newsroom + Reuters. Check publication timestamps, not crawler timestamps. Do not stop after a single generic search or assume no story exists merely because the previous scan skipped it. **Do not invent** discoveries, urgency, source independence, engagement velocity or benchmark results; if unverified, skip the story.

At the weekday ES experimental window 19:30–21:00, a **single** well-supported, distinctive news item can be assessed as an experiment if at least 82/100 by the existing seven-factor rubric, all effective policy/runtime gates and free-tier budgets allow, no comparable evening experiment has already run that day, and there is real audience utility. This is not a daily posting quota and does not lower thresholds or make night posting the default. Outside windows, only policy-eligible exceptional breaking news should proceed.

Before a due-now job: read HEAD; check results/pending for repeated event, cross-language reuse, failed/review/ambiguous state, native-topic cooldown, 18-hour category cooldown, >=60-minute global gap, effective scores and budgets; validate `jobSchema` and source rights. Use `mcp__GitHub__create_file` on main, one JSON per commit, verify path and commit SHA by readback. Do not send unverified future-dated READY jobs. Never manually dispatch Actions or retry ambiguous deliveries.

After enqueue, inspect the **push-triggered** queue run and `jobs/results/<id>.json`; only Buffer `provider_status:sent`, real `provider_post_id`, and `external_url` (when supplied) count as delivered. Report that exact permalink when available. A failed attempt, missing result, missing URL, or GitHub commit alone must not be described as publication. Preserve the existing single hourly task and its timing; never disable it because one scan is blocked.

A consumer unable to see a post should first compare the Buffer permalink and connected Threads account handle; provider `sent` is evidence of provider-confirmed delivery, **not direct inspection of the signed-in Threads timeline**. The task's ChatGPT notification settings are independent of provider publishing and should never be inferred from queue success.
