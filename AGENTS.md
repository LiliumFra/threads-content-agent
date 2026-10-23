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

## Editorial operations quality upgrade (2026-10-23)

The concrete active-window research, audience-hour priorities, cards-versus-text decision, confirmation and metrics requirements are in `docs/EDITORIAL_EXECUTION_PLAYBOOK.md` and `config/growth.json.editorial_execution`. Read them **before candidate selection**, after the immutable policy/schema preflight. This is a documented improvement to existing hourly scans, **not** a new scheduler and not a license to increase provider ceilings, lower score thresholds or post filler.

- During an otherwise eligible slot, investigate 3–4 distinct technology lanes and verify the best two *different* events. If the first event fails, investigate the next lane before declaring zero opportunities. The five-post daily goal remains conditional.
- Use the audience-local 2026 Buffer timing baseline only to prioritize stories **within** already approved windows; resolve `Europe/London`, `America/New_York` and `America/Los_Angeles` offsets with DST, and publish only due-now within the valid window.
- Prefer `visual.mode: "card"` when a factual deadline, availability, exact figure, software version or action step adds value. Never choose `none` merely to save effort: it must be an intentional editorial decision. Honour Cloudinary /usage fail-closed and media caps.
- Vary the actual substance: one precise claim, its scope/limitation and what the reader can do; avoid formulaic generic questions or copying a previous angle. Score the seven configured terms accurately, with unproven discussion velocity set to 0.
- Compute learning **only** from provider-confirmed sent posts with metrics observed after >=24h; preserve >=20 comparable per segment before adapting windows. In blocked or ambiguous cases, leave the hourly task enabled without manually dispatching Actions.

## Hourly editorial execution — avoid false empty scans

The hourly ChatGPT task is the **discovery controller**; queue.yml only processes JSON already committed. A successful empty-queue Action does not indicate a publication attempt. Do not confuse the six-hour queue recovery cron with an hourly news scout.

During a permitted audience window, if `jobs/pending` is empty and no provider incident exists, check **2–4 distinct, recent topic lanes** (at least AI/models, Android/consumer software, chips/robotics or security, adjusted to the latest 18-hour topic history). Start with a primary release/changelog or technical source and independently verify the best candidate with reputable reporting; e.g. official newsroom + Reuters. Check publication timestamps, not crawler timestamps. Do not stop after a single generic search or assume no story exists merely because the previous scan skipped it. **Do not invent** discoveries, urgency, source independence, engagement velocity or benchmark results; if unverified, skip the story.

At the weekday ES experimental window 19:30–21:00, a **single** well-supported, distinctive news item can be assessed as an experiment if at least 82/100 by the existing seven-factor rubric, all effective policy/runtime gates and free-tier budgets allow, no comparable evening experiment has already run that day, and there is real audience utility. This is not a daily posting quota and does not lower thresholds or make night posting the default. Outside windows, only policy-eligible exceptional breaking news should proceed.

Before a due-now job: read HEAD; check results/pending for repeated event, cross-language reuse, failed/review/ambiguous state, native-topic cooldown, 18-hour category cooldown, >=60-minute global gap, effective scores and budgets; validate `jobSchema` and source rights. Use `mcp__GitHub__create_file` on main, one JSON per commit, verify path and commit SHA by readback. Do not send unverified future-dated READY jobs. Never manually dispatch Actions or retry ambiguous deliveries.

After enqueue, inspect the **push-triggered** queue run and `jobs/results/<id>.json`; only Buffer `provider_status:sent`, real `provider_post_id`, and `external_url` (when supplied) count as delivered. Report that exact permalink when available. A failed attempt, missing result, missing URL, or GitHub commit alone must not be described as publication. Preserve the existing single hourly task and its timing; never disable it because one scan is blocked.

A consumer unable to see a post should first compare the Buffer permalink and connected Threads account handle; provider `sent` is evidence of provider-confirmed delivery, **not direct inspection of the signed-in Threads timeline**. The task's ChatGPT notification settings are independent of provider publishing and should never be inferred from queue success.

## Publication commit trigger integrity

The queue workflow is triggered by a `main` push that changes `jobs/pending/*.json`, but GitHub Actions **does not run push workflows for commits whose messages contain CI-skip directives**. This caused a confirmed 2026-10-21 incident: DSX POD was queued in commit `cf2ebf5` with `[skip ci]`; it was sent only when the six-hour recovery processed it, 3h32m after the intended audience slot.

**Strict commit-message split:**
- **New approved READY publication job:** commit message must be `content(threads): queue <verified-story-short-title>` or equivalent, **without** `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, or any CI-suppression marker, including in trailers. Read back commit message and new file after creation.
- **Docs, pure research, metric/result persistence:** may use `[skip ci]` when appropriate to avoid needless Actions, but never mix these with a new pending JSON in one commit.
- **Before pushing:** ensure the confirmed delivery gap, native topic and category cooldowns, verified sources, due-now `publish_at`, time window, score and provider headroom are valid; avoid a pending job that would be published much later by recovery.
- **After pushing:** check whether the expected push-triggered queue run exists and the corresponding job moved to `jobs/results`. If no run appeared or results are ambiguous, label as `ENQUEUED_NOT_CONFIRMED`, never `PUBLISHED`; do not enqueue another just to wake a stalled job or retry a delivery blindly. Reconcile the existing pending job safely first. If GitHub denies edits, report an explicit bounded blocker and leave the hourly discovery task enabled.

The hourly scan is a **research opportunity**, not a promise of one published post per hour. The five-per-day setting is an evidence-dependent target, never a reason to lower the existing gates or post filler. A low count should be diagnosed as: candidates found/verified, candidates blocked by quality/time/cooldown, GitHub write/trigger failures, and provider-confirmed deliveries. Preserve the existing task/schedule and all budgets.
