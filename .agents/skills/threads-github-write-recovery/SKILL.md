---
name: threads-github-write-recovery
description: Diagnose and recover authorized GitHub enqueue writes for the Threads content agent without circumventing security or publishing controls.
---
# GitHub write recovery — Threads

Repository scope: `LiliumFra/threads-content-agent`, branch `main`. Do not touch other repositories.

## Preflight
Read `AGENTS.md`, `README.md`, `config/policy.json`, `config/automation.json`, `config/growth.json`, `docs/EDITORIAL_POLICY.md`, `docs/MEDIA_POLICY.md`, `docs/FREE_TIER_OPERATIONS.md`, `src/domain/job.ts`, `jobs/pending`, and `jobs/results`. Read HEAD and verify publication is enabled and live. The stricter restriction wins.

## Diagnose write failures
1. Confirm repo visibility, connector identity and repository push permission, installation scope, default branch, branch protection and rulesets.
2. Distinguish GitHub API errors (401 auth; 403 insufficient permission; 404 missing installation/path; 409 stale ref; 422 duplicate/validation; 429 quota) from upstream connector security denials. If rejected by upstream policy before GitHub, stop; do not use lower-level Git objects, a different connector, or alternative transport to bypass that decision.
3. A successful empty-queue Action is NOT a discovery or enqueue success. The six-hour recovery cron cannot invent new stories.

## Authorized publication flow
Check latest HEAD and absence of intended path. Verify recent >=2 independent sources, real date, scoring, language/window, 60-minute interval, 18-hour topic cooldown, dedupe across pending/results, provider budget and media rights. Require current editorial authorization, all caps, and a valid zod-compatible JSON with `schema_version:1`, `status:READY`, `action:post`, `dry_run:false`, `publish_at` due now and precise topic. Commit exactly one new `jobs/pending/<id>.json` via the approved GitHub file action only. Read back the file, commit SHA and HEAD. Never manually dispatch Actions.

Only call a post published after provider reports `sent`, with provider ID; `REVIEW`, `DELIVERY_PENDING`, scheduled and failed are not delivered. No blind retries, paid services, secret disclosure or changes to provider budgets. Keep the single hourly scanner enabled even if one scan is blocked.

## Failure outcome
Report exact provider/tool error and known-good checks. Do not claim a commit or a published post without readback evidence.
