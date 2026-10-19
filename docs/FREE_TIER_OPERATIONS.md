# Free-tier operations and hard boundaries (October 2026)

## Providers

- Buffer Free (official pricing and rate limits): 1 API key, at most 3 channels, 10 **simultaneously queued** scheduled posts per channel, 100 requests / rolling 15m, 250 / rolling 24h, 3,000 / rolling 30d. These are NOT ten posts per month. Source: https://developers.buffer.com/guides/api-limits.html and https://buffer.com/pricing
- Buffer operational ceilings: 25 requests / 15m; 80 / 24h; 2,400 / 30d. The worker inspects authoritative `RateLimit` response headers from its existing GraphQL calls, and suspends subsequent requests when a budget is exhausted. This includes other traffic using the same Buffer API client, including MCP. The first request of a newly started worker acts as a quota probe. Missing or malformed headers fail closed.
- Cloudinary Free (official billing): 25 credits across a rolling 30-day window for transformations + bandwidth; storage is a current snapshot. **One credit does NOT mean one image.** Source: https://cloudinary.com/documentation/billing_and_plans
- Cloudinary operational protection: read account credits from the Admin API `GET /usage` with existing Cloudinary API credentials before media upload, defer when usage >= 20 credits or report cannot be read, and cap this publisher at 8 media uploads per local policy day. Provider usage may lag by a day, and usage from other product environments can differ from environment-level data. Inspect the Cloudinary Console to validate account-wide usage; automatic checks cannot guarantee that shared usage never spikes.
- GitHub Free private repositories (official billing): 2,000 minutes/month for standard runners, **shared with other repositories under the owner**. Standard runners in public repositories are free. Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions and https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## Workflow savings

- Pending JSON commits still wake queue.yml immediately (no scheduled delay for newly enqueued due jobs).
- Low-frequency recovery `17 */6 * * *` UTC replaces every-two-hours fallback. Future-dated deferred jobs may wait up to approximately six hours after becoming eligible; critical breaking content must be enqueued due-now by the editorial controller and let the push trigger work.
- Queue and metrics workflows skip Node installation/build/provider calls when their respective JSON folder is empty.
- Metrics run once daily and refresh only up to 30 recent results; do not increase frequency merely to consume a quota.
- Deterministic 1080x1350 SVG + Sharp cards do not call a paid generative-image model. Do not enable paid models or services without separate express authorization.
- Keep GitHub Actions artifacts and binaries out of the repository. Do not claim this code knows the owner's live remaining GitHub Actions minutes; billing is account-scoped, and GitHub Billing remains the authority.

## Operational constraints

- On insufficient provider headroom, prefer holding the eligible job in `jobs/pending` over stripping required visual assets or switching to a paid tier. Preserve the existing idempotency, safety intervals, source checks and high-score thresholds.
- Cloudinary API availability or missing admin `/usage` rights leads to deferred image jobs, not unverified expenditure. For genuinely urgent events use a separate explicitly authorized text-only job if editorially appropriate, not an implicit downgrade.
- Provider ceilings are shared across languages. Adaptive tuning must not raise them.
- Live publish confirmation requires Buffer/Threads provider ID, never just a commit SHA.
