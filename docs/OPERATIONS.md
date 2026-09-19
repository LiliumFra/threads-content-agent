# Operations

## Commission in dry-run first

Create one unique JSON file under jobs/pending with dry_run set to true. The commit immediately wakes the queue workflow.

A dry-run validates the JSON contract, publication policy and visual renderer but never calls Threads.

After that passes, test one text-only live post before enabling generated images.

## Meta / Threads credentials

Create a Meta app with the Threads use case and authorize the account that will publish.

Publishing normally needs:

- threads_basic
- threads_content_publish

Metrics additionally need:

- threads_manage_insights

Official Meta Threads API workspace:
https://www.postman.com/meta/threads/overview

Store the long-lived token only in the repository Actions secret:

THREADS_ACCESS_TOKEN

Never put it in a job file, commit, log command or chat message.

## Public media hosting

Threads downloads image media from the URL supplied to its API. Generated images therefore need public hosting.

This project uses signed Cloudinary uploads with repository secrets:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Optional repository variable:

- CLOUDINARY_FOLDER

If a card job is live and Cloudinary is missing, publication fails closed.

## Job lifecycle

A job begins as jobs/pending/<id>.json with status READY.

Terminal results are moved to jobs/results/<id>.json as:

- DRY_RUN
- PUBLISHED
- FAILED\n- REVIEW — the remote publication state is ambiguous and must not be auto-retried

Retryable conditions remain in pending:

- publish_at is still in the future
- daily cap reached
- minimum interval not reached
- topic cooldown active

queue.yml runs on each pending-job push and every five minutes as a fallback. Live jobs also check Meta's current API quota before uploading or publishing.

## Creating jobs from ChatGPT

ChatGPT should create a unique path such as:

jobs/pending/2026-09-19T153000Z-ai-agents.json

The JSON must follow examples/job.json.

For production trend jobs ChatGPT should research current sources, verify claims, create an original angle, keep standard text at 500 characters or fewer, provide alt text for cards, and include source URLs.

## Metrics

metrics.yml refreshes lifetime views, likes, replies, reposts and quotes for PUBLISHED result files.

## Recovery

FAILED and REVIEW are terminal by design. REVIEW specifically means the API response was ambiguous enough that automatic retry could create a duplicate.

Inspect the result error, create a corrected new pending job with a new filename, and let the system evaluate it from scratch.

## Token rotation

If a credential is exposed, revoke or rotate it at the provider. Deleting a chat or commit does not revoke it.
