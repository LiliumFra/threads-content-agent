# Threads editorial execution playbook — 2026-10-23

This is a **bounded operating procedure**, not an extra scheduler. Apply `AGENTS.md`, `config/policy.json`, `config/automation.json`, `config/growth.json`, `docs/EDITORIAL_POLICY.md` and `docs/MEDIA_POLICY.md` first. Strictest restrictions win. This document does not increase provider spend, reduce the 60-minute spacing, alter the hourly ChatGPT task, or automatically trigger GitHub Actions.

## Baseline and why change is necessary

Repository results verified on 2026-10-23 for 2026-10-19 through 2026-10-22: **8** posts with Buffer `provider_status: sent` and a provider ID / Threads permalink; **4** of the 8 had `visual.mode: card`, the other **4** had `none`. Seven posts with saved view counts sum to 252 views, with no replies/reposts/likes in those saved snapshots; the newest post had no mature metrics. This is far below the sample needed for a causal timing or visual-format conclusion. One image job failed at the provider and was separately retried only after media diagnosis, so presence of a generated image does not equal delivery.

A 2026 Buffer observational analysis of 2.5 million Threads posts found higher *median engagement* on weekday mornings, with notable audience-local Thursday 09:00 and Wednesday 12:00 peaks. This is a **prior**, not evidence that any one slot guarantees performance here: https://buffer.com/resources/the-best-time-to-post-on-threads/.

## Each active-window scan: find opportunities before declaring an empty cycle

1. First check HEAD, effective config, **all** pending JSON, and results statuses. Read result contents rather than using filenames; only Buffer `sent` with a provider ID is delivered. Dedupe across failed/review/pending/delivery_pending and cross-language outcomes; block publishing if stale `READY` could be woken at an inappropriate time.
2. Scan **3–4 distinct nonpolitical lanes** if there is eligible time and no unresolved provider issue: (a) Android and high-install-base consumer software, (b) AI models/developer APIs with actual public eligibility, (c) GPUs, chips and robotics, (d) cybersecurity with concrete affected versions/patches. Rotate away from the past 18h's internal topics, not merely proper nouns. Favor primary technical announcements, official release logs and dated advisories.
3. Verify the **two strongest independent candidate events** more deeply, not two rewrites of the same announcement. Record announcement timestamp and publication dates, claim-level primary evidence and a distinct authoritative/professional corroborator. If a source does not corroborate the *central claim*, replace it or narrow the claim. If neither candidate clears the gates, publish nothing.
4. Score using **exact** `automation.json.weights` (15/15/15/15/15/15/10) with an auditable sum; `discussion_velocity=0` without real timestamped conversation evidence. Normal ES >=72, original EN >=78, all effective volume thresholds, and exceptional breaking >=90; a limited ES evening control requires >=82. **Do not add unjustified points** to hit a quota or inflate engagement.
5. Choose the **one strongest** eligible candidate by news value, audience relevance, concrete utility, credible novelty and event dedupe. Occasionally allow more than one per scan only if all time intervals, provider budgets, cooldowns and corresponding window constraints independently pass; under normal hourly operation, one due-now job is the safe default.

### Timely selection instead of future-dated READY jobs

- The only hourly clock is the *discovery* task at about `HH:11`. Its successful scans require new job commits; `queue.yml` has a 6-hour recovery, **not** an hourly news crawler.
- ES weekday audience windows remain 08:00–11:30, 12:00–13:30, and secondary 16:00–17:30; weekend 09:00–11:30. Within those windows, favor Thursday 09h/10h, Wednesday 12h/09h, Tuesday 10h/09h, Friday 10h/09h, Monday 12h/09h when story quality is comparable. At `09:11` do **not** pretend to publish at `09:00`.
- EN audience mornings are evaluated using actual clocks: `Europe/London`, `America/New_York`, `America/Los_Angeles`. Example target 09:00 in UK corresponds to 05:00 Jujuy in BST and 06:00 in GMT; Eastern 09:00 corresponds to 10:00 Jujuy in EDT and 11:00 in EST; Pacific 09:00 corresponds to 13:00 in PDT and 14:00 in PST. Confirm real offsets for the date. Existing allowed Jujuy windows remain authoritative; these conversions are examples, not additional ranges.
- A single bilingual account shares the full 60-minute minimum global spacing, preferred 75 minutes, native-topic cap/cooldown and 18-hour category cooldown. Prioritize **original** English opportunities when the target audience is awake, rather than mechanically translating the latest Spanish post.
- Avoid evening by default; at most one supported >=82 ES control candidate per weekday, and only if other gates and cooldowns hold. Off-peak: lightweight genuine >=90 breaking triage only.
- For normal approved publishing, `publish_at` must be truthful **due-now**, never future-dated for an attractive slot. If the proper window is missed, skip it. Never bypass GitHub write denials or manually dispatch workflows.
- Editorial cadence **targets 5 per day**, with capacity to 8 only where source quality and provider headroom permit; high-volume thresholds remain unchanged. No filler or automatic extra scheduling.

### Format selection that produces more useful visuals

The current job schema supports `visual.mode: "card"` or `"none"`. A card is **preferred when it adds new verified information** rather than merely repeating text. Suitable subjects include: a release or closure deadline; affected device/version list; security update action; benchmark *with the measurement context*; eligibility, country or price; numerical before/after comparisons. Examples:

- Browser shutdown: headline “ARC CIERRA EN DICIEMBRE”; subheadline “Exportá tus datos antes del cierre · fecha oficial verificada”; post text explains the actual steps and platform-specific caveats.
- Model API: headline “¿QUIÉN PUEDE USARLO?”; subheadline shows only confirmed access region, costs and model limitations rather than speculative capabilities.
- Security notice: headline “ACTUALIZACIÓN CRÍTICA”; subheadline identifies verified affected versions and the official mitigation, **not** unsupported severity claims.

Cards: concise headline ideally 4–8 words, a complementary subheadline with one or two *verified* facts, contextual topic, source hostname, useful `alt_text`; inspect the renderer's current line limits so text is not clipped. Generate deterministic SVG -> compliant JPEG by current worker; don't imply carousel or AI-video support. Source imagery only with license and rights provenance. Card preference is **not authorization to spend credits blindly**: check the Cloudinary `/usage` gate, configured image/day limit, and existing uploads; image-dependent stories should be held if capacity is unavailable rather than silently downgraded. An intentional text-only post is permitted when nuance or genuine conversation is stronger than an image, with the internal editorial reason made explicit (do not add unrecognized schema fields).

### Copy must sound like useful news, not a news-feed mirror

Start with the consequence or specific new fact, not a generic “X anunció”. Explain *who is affected* and the condition/caveat in ~170–360 characters when feasible (hard ceiling 500). An actual step, a clearly scoped trade-off or a precise comparison usually beats generic CTAs. Avoid repeated “¿Qué opinás?” endings, fake quotes, fabricated virality, unverified screenshots, promotional links, irrelevant native topics and robotic ES->EN translation. Give each post a factual reason someone would save, share, act on or discuss it. The source list belongs in `strategy.sources`, while the published copy stays readable.

### Confirmation and measurement

Each due-now approved `jobs/pending/<id>.json` gets its **own** commit with no CI skip directive. Verify commit, expected push-run and eventual `jobs/results/<id>.json`. A new commit is `ENQUEUED_NOT_CONFIRMED` until Buffer provider status is `sent`; `sending`, `scheduled`, `FAILED`, `REVIEW`, and `DELIVERY_PENDING` are not delivered.

Once daily, the existing metrics workflow is sufficient. For adaptation, require provider-sent post ID, `published_at`, and a metrics sample **observed at least 24h later**. Distinguish views, likes/reposts, replies and conversion; never turn missing profile/follower data into zeros. Evaluate ES/EN separately by audience-local day/hour, topic, hook and visual; keep the original 28-day trial and require >=20 comparable mature examples per segment before account-specific clock shifts or claims of superior visuals. Report missed opportunities as one of: insufficient discovery, editorial rejection, timing/cooldown, tool write block, provider cap, or actual delivery failure. Do not count two provider copies of the same job as independent content.
