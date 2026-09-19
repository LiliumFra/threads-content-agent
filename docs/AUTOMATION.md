# Recurring automation

The recurring controller is ChatGPT normal, not an OpenAI API client.

On each trend scan:

1. Read `config/automation.json`, `config/growth.json`, `config/storage.json`, `docs/EDITORIAL_POLICY.md` and `docs/MEDIA_POLICY.md`.
2. If `enabled=false`, stop without creating a job.
3. Inspect recent `jobs/results` and `jobs/pending` for deduplication, daily capacity, topic rotation, content-mix balance and performance context.
4. Research current technology discussion every hour, including public Threads signals when available.
5. Verify factual claims with current reliable sources.
6. Score candidates using the configured seven-factor score.
7. If no candidate meets the threshold, do nothing.
8. Aim for four useful posts per day, allow six on unusually strong news days, and treat eight as an exceptional hard ceiling rather than a target. Apply escalating score thresholds as daily volume rises.
9. Use the preferred time windows for normal content. Breaking news may publish immediately when it reaches the configured breaking-news threshold.
10. Create at most `max_jobs_per_scan` jobs and keep the runtime hard cap at five posts per day.
11. Set one native Threads topic through `content.topic_tag` when supported.
12. Attach strategy metadata such as content type, score and hook style for later learning.
13. Prefer the richer editorial renderer. Use external imagery only under `docs/MEDIA_POLICY.md`.
14. GitHub Actions handles rendering, Cloudinary upload, Buffer publishing and result persistence.

## Performance loop

Buffer exposes per-post metrics and normalizes Threads replies to `comments`. Its documented metrics can lag the source network, so the repo refreshes metrics daily rather than wasting API calls on false real-time precision.

Use the latest 20–30 posts to compare:

- content type;
- native topic;
- hook style;
- publish hour;
- visual treatment;
- comments/replies;
- reposts;
- quotes;
- engagement rate;
- views/reach when available.

Do not auto-tune from one outlier. Require the minimum sample in `config/growth.json`.

## Engagement capability

Buffer currently documents experimental engagement capability metadata but its public quick-start operation set remains focused on creating, deleting and retrieving posts plus account/organization/channel data. Do not fabricate a comment-reply mutation.

Until a stable reply operation is documented for the connected Threads channel, the growth review should identify posts with meaningful reply activity and recommend manual response.

## GitHub Actions cost control

Normal publishing is push-driven. The scheduled queue is only a recovery mechanism for future-dated jobs. Metrics refresh once per day because Buffer's metrics themselves may lag by roughly a day.

CI should not run for ordinary editorial result commits.

## Live state

The system is currently live through Buffer, with Cloudinary as the public image host. Direct Meta Threads API support remains a fallback implementation.


## API-budget guardrail

Hourly research does not itself call Buffer or Cloudinary. Provider usage happens only when a job publishes or metrics refresh.

Operational planning assumes a conservative Buffer budget of 80 authenticated requests/day and 2,400/30 days. A single isolated publication currently costs approximately three Buffer calls because it discovers organization/channel and then creates the post; a batch is cheaper because discovery is cached inside the worker. Daily metrics refresh is capped to the 30 newest result files.

Cloudinary receives at most one production image upload per published visual job. Rejected trend candidates never consume Cloudinary credits.
