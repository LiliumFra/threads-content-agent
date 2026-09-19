# Threads Content Agent

Production-oriented automation for discovering, preparing and publishing original Threads content while keeping **ChatGPT normal** as the editorial brain.

## Architecture

```
ChatGPT normal
  -> GitHub Issue (structured Threads job)
  -> GitHub Actions
  -> validation / dedup / rate limits
  -> deterministic visual renderer
  -> public media uploader
  -> official Meta Threads API
  -> post + metrics
  -> GitHub Issue result
```

No OpenAI API, Codex, Work, browser automation or Threads cookies are required.

## Current scope

- Structured jobs carried by GitHub Issues.
- Official Threads API publisher for text and image posts.
- Replies and quote posts supported by the job contract.
- Deterministic 1080x1350 visual cards rendered locally with SVG + Sharp.
- Signed Cloudinary upload adapter for public image hosting.
- Content hashing and idempotency.
- Daily publication cap, minimum publication interval and topic cooldown.
- Scheduled queue processing.
- Scheduled post-insights collection.
- Dry-run mode for safe commissioning.
- Tests and strict TypeScript.

## Required GitHub Actions secrets

For publishing:

- `THREADS_ACCESS_TOKEN` — long-lived Threads user token with the required permissions.

For generated image posts:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Until `THREADS_ACCESS_TOKEN` exists, leave `dry_run: true` in jobs.

## Threads permissions

The Meta app/user token should include the permissions needed by the features you use, including `threads_basic`, `threads_content_publish`, and for metrics `threads_manage_insights`.

## Creating a job

Create an Issue whose title starts with `[Threads Job]` and whose body contains one fenced JSON object:

```json
{
  "schema_version": 1,
  "status": "READY",
  "publish_at": "2026-09-19T15:00:00-03:00",
  "action": "post",
  "topic": "artificial-intelligence",
  "language": "es",
  "content": {
    "text": "Texto final para Threads.",
    "topic_tag": "IA",
    "reply_control": "everyone"
  },
  "visual": {
    "mode": "card",
    "headline": "La idea principal",
    "subheadline": "Contexto breve que aporte valor",
    "eyebrow": "TECNOLOGÍA",
    "alt_text": "Tarjeta editorial que resume la idea principal."
  },
  "strategy": {
    "hook_style": "curiosity",
    "goal": "conversation",
    "sources": ["https://example.com/source"]
  },
  "dry_run": true
}
```

The event workflow evaluates the issue immediately. Future-dated jobs remain queued and the scheduled queue workflow picks them up when due.

## Safety model

Publishing is intentionally fail-closed:

- malformed jobs do not publish;
- duplicate content does not publish;
- jobs above configured rate limits do not publish;
- image jobs fail if public media hosting is unavailable;
- missing Threads credentials fail or remain dry-run;
- the same issue cannot publish twice.

See `docs/OPERATIONS.md` for commissioning and secret setup.

## Status

Initial production scaffold. Start in dry-run, validate at least one text job and one image job, then enable live publishing.
