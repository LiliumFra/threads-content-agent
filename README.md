# Threads Content Agent

Production-oriented automation for researching, preparing and publishing original Threads content while keeping **ChatGPT normal** as the editorial brain.

## Architecture

ChatGPT normal -> Git commit with jobs/pending/<job>.json -> GitHub Actions -> validation / policy / rendering -> Buffer API -> Threads -> jobs/results/<job>.json -> metrics refresh.

No OpenAI API, Codex, Work, browser automation, Threads cookies or Meta Developer app are required for the primary path.

## Primary provider

Buffer is the default publisher. The worker authenticates with BUFFER_API_KEY, discovers the connected Threads channel automatically, publishes through Buffer's GraphQL API and reads per-post performance metrics back through Buffer.

The direct Threads API implementation remains available as a fallback provider.

## Current scope

- Event-driven queue through versioned JSON jobs.
- Low-cost scheduled recovery every six hours.
- Buffer publishing for Threads text and generated-image posts.
- Deterministic 1080x1350 editorial cards rendered with SVG + Sharp.
- Signed Cloudinary upload adapter for public image hosting.
- Content hashing, idempotency, daily cap, minimum interval and topic cooldown.
- Buffer post metrics for the 30 most recent result files once per day.
- Dry-run commissioning mode.
- Strict TypeScript, reproducible npm lockfile and CI tests.

## Required GitHub Actions secret

Text publishing:

- BUFFER_API_KEY

Generated image posts additionally require:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Optional repository variables:

- BUFFER_CHANNEL_ID — only required when the Buffer account has multiple active Threads channels.
- BUFFER_ORGANIZATION_ID — optional discovery shortcut.
- CLOUDINARY_FOLDER

See docs/BUFFER_SETUP.md before enabling live publishing.
