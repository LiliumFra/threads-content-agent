# Operations

## Commission in dry-run first

Create one Threads Job issue with dry_run set to true. A dry-run validates the JSON contract, policy and visual renderer but does not publish.

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

Add the long-lived token at:

Repository Settings -> Secrets and variables -> Actions -> New repository secret

Name:

THREADS_ACCESS_TOKEN

Never place the token in an Issue, commit, Actions command, or chat message.

## Public media hosting

Threads fetches image media from the URL passed to its API, so generated images need a public URL.

This project uses signed Cloudinary uploads. Add these repository secrets:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Optional repository variable:

- CLOUDINARY_FOLDER

If visual.mode is card and Cloudinary is missing, the agent fails closed rather than silently publishing text only.

## Lifecycle

READY -> PROCESSING -> PUBLISHED
READY -> PROCESSING -> FAILED
READY -> DRY_RUN

Future publish_at jobs remain READY. The queue workflow wakes four times per hour and processes due jobs serially.

## Editorial policy

config/policy.json controls the local daily cap, minimum interval, topic cooldown, duplicate lookback and metric refresh cadence.

The content hash prevents an exact semantic duplicate from being posted again inside the lookback window.

## Metrics

The metrics workflow refreshes lifetime views, likes, replies, reposts and quotes and writes them into the Issue job JSON.

## ChatGPT operating contract

For production jobs ChatGPT should research a current topic, verify claims against reliable sources, create original wording rather than copying viral posts, include sources, write useful alt text and schedule conservatively.

Use dry_run=true while commissioning.

## Recovery

FAILED deliberately does not retry live publishing automatically.

Correct the cause, set status to READY, remove the old result object, reopen or edit the Issue, and let the event workflow evaluate it again.

## Token rotation

If a credential is exposed, revoke or rotate it at the provider. Deleting a chat, Issue or commit does not revoke a credential.
