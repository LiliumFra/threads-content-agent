# Threads Content Agent

Production-oriented automation for researching, preparing and publishing original Threads content while keeping **ChatGPT normal** as the editorial brain.

## Architecture

ChatGPT normal -> Git commit with jobs/pending/<job>.json -> GitHub Actions -> validation / policy / rendering -> official Threads API -> jobs/results/<job>.json -> metrics refresh.

No OpenAI API, Codex, Work, browser automation or Threads cookies are required.

## Why the queue is file-based

The ChatGPT GitHub connector reliably creates commits, and GitHub Actions reliably reacts to those pushes. A job file is therefore both the durable queue item and the event that wakes the publisher.

This avoids relying on Issue events from integrations, which GitHub may not forward into Actions.

## Current scope

- Event-driven queue through versioned JSON jobs.
- Scheduled fallback every five minutes for future publish_at values.
- Official Threads API publisher for text and generated-image posts.
- Replies and quote posts supported by the job contract.
- Deterministic 1080x1350 editorial cards rendered with SVG + Sharp.
- Signed Cloudinary upload adapter for public image hosting.
- Content hashing, idempotency, daily cap, minimum interval and topic cooldown.
- Scheduled post-insights collection.
- Dry-run commissioning mode.
- Strict TypeScript and CI tests.

## Queue layout

- jobs/pending/ — jobs waiting to run.
- jobs/results/ — immutable-ish audit/result records, later enriched with metrics.

A pending file is removed only after DRY_RUN, PUBLISHED or FAILED has been persisted to jobs/results.

Retryable policy conditions such as a future publish time, daily cap, minimum interval or topic cooldown leave the job in pending.

## Required GitHub Actions secrets

Publishing:

- THREADS_ACCESS_TOKEN

Generated image posts:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Optional repository variable:

- CLOUDINARY_FOLDER

## Creating a job

Create a unique JSON file under jobs/pending. See examples/job.json.

The push wakes queue.yml immediately. Future-dated jobs remain pending and are picked up by the scheduled fallback.

## Safety model

Publishing fails closed:

- malformed jobs are not published;
- semantic duplicates are not published;
- jobs above policy limits remain queued or fail as appropriate;
- image jobs fail if public media hosting is unavailable;
- missing Threads credentials cannot publish;
- an existing result file prevents a job from being processed twice.

See docs/OPERATIONS.md for commissioning and credentials.
