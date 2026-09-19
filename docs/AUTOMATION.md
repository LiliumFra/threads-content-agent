# Recurring automation

The intended recurring controller is ChatGPT normal, not an OpenAI API client.

On each scheduled scan:

1. Read config/automation.json.
2. If enabled is false, stop without creating a job.
3. Read recent jobs/results and jobs/pending for deduplication and performance context.
4. Research current technology discussion, including public Threads signals when available.
5. Verify factual claims with current reliable sources.
6. Score candidates using docs/EDITORIAL_POLICY.md.
7. If no candidate meets the threshold, do nothing.
8. Create at most max_jobs_per_scan JSON files under jobs/pending.
9. GitHub Actions handles rendering, quota checks, publication and result persistence.

The scheduled ChatGPT task must never put access tokens or service credentials into the repository.

## Activation sequence

Keep the automation disabled and in dry-run until:

- THREADS_ACCESS_TOKEN is configured;
- a text-only live smoke test succeeds;
- Cloudinary secrets are configured;
- an image live smoke test succeeds.

After both smoke tests, change:

enabled -> true
publish_mode -> live

Do not activate live mode merely because CI is green; CI does not validate account credentials.
