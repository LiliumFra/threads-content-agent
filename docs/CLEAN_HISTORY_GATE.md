# Clean-history publication gate

Status: **CANDIDATE ONLY — DO NOT MAKE THIS REPOSITORY PUBLIC YET**.

This branch is an isolated source-code snapshot intended to avoid carrying historic `jobs/pending/*.json`, `jobs/results/*.json` and `state/manual-breakouts.json` records in its own branch ancestry. It preserves the application code, configuration, GitHub Actions workflows and existing renderer.

## Verified historical risks

- Previous `main` commits introduced account-specific post payloads, provider post identifiers and performance metrics, later deleted from the working tree.
- A former tracked `state/manual-breakouts.json` held non-public account analytics.
- A numeric account-specific editorial case study was present in `docs/EDITORIAL_POLICY.md`; it was replaced with a generic policy in this snapshot.
- `config/growth.json` contained a reference to an internal account-specific benchmark; it was generalized.

No credential-shaped literal was found in the reviewed current code, configuration and selected historical samples. This was not a comprehensive scan of every Git blob, workflow artifact, pull request or log. If any live token is suspected of exposure, rotate it first.

## Important: no publication approval

- The original `main` and other branch/PR refs still exist and can reference the former history. Merely switching to this branch does **not** make the same GitHub repository safe to publish.
- GitHub may retain cached commit views and pull-request references after force-pushes. Contact GitHub Support if the risk justifies expunging sensitive cached data.
- Current `.github/workflows/queue.yml` persists `jobs/pending` and `jobs/results` into Git; `metrics.yml` persists result metrics and strategy state. **These would expose new operational data in a public repository.** Migrate private jobs, results and analytics to a separate access-controlled store, retaining only public-safe code in this repository, before switching visibility.
- Audit all workflow logs and artifacts, open and closed PRs, other branch tips, all historical blobs and all config files; revoke/rotate compromised credentials.
- Preserve intentional production behavior and existing publishing quotas while migrating. Do not re-run queue jobs or replay historical posts as part of sanitation.
- For a genuinely clean public history, prefer a *new repository* initialized from this vetted source snapshot rather than changing visibility of the existing repository. Before doing that, repeat a full code/secrets scan and review the public workflows.

The existence of this branch is **not** evidence that remote caches were purged or that a live post was published.
