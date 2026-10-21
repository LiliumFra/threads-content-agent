# Editorial policy

This file defines the operating contract for the recurring ChatGPT trend scout.

## Objective

Grow the account through original, useful technology content that earns attention and conversation without turning the feed into an RSS mirror. The system should prefer skipping a weak scan over manufacturing urgency.

The growth strategy is defined in `config/growth.json`. Runtime safety limits are defined in `config/policy.json`.

## Publishing cadence

- Base target: 5 posts per day when enough strong independent stories exist.
- Normal elastic capacity: up to 8 posts per day.
- Configured hard ceiling: 16 posts per day, exclusively when the effective policy and runtime gates agree. This is capacity, never a quota; posts 13–16 are reserved for genuinely exceptional independently verified news.
- Scan for new developments every hour at approximately minute 11 of each local hour. This is a discovery interval, not a required publishing interval.
- Standard spacing: about 75 minutes.
- Runtime minimum spacing: 60 minutes.
- The quality threshold rises with volume: score 72 through post 5, 78 through post 8, 84 through post 10, 90 for posts 11–12, and 94 for posts 13–16. Respect the strictest persisted policy/configuration; no automatic hard-cap increases.
- Count pending jobs toward daily capacity so a busy scan cannot silently overbook later slots.
- If mature matched samples show declining per-post quality, the adaptive controller should reduce target volume rather than defend a posting quota.
- Breaking news scoring at least the configured breaking-news threshold may take the earliest policy-valid slot rather than waiting for a preferred window, but never bypasses the hard daily cap or API budgets.

Preferred local windows are stored in `config/growth.json` under `cadence.audience_windows_local`, with overrides and quality rules in `config/automation.json`. They are guidance for normal posts, not a reason to delay genuinely time-sensitive news.

### Audience-aware scheduling experiment (2026-10-19 onwards)

Source-backed baseline: Buffer's 2026 comparison of 2.5 million Threads posts shows stronger median engagement during weekday mornings, especially Wednesday/Thursday. This is observational aggregate guidance; account-specific evidence still takes precedence. Source: https://buffer.com/resources/the-best-time-to-post-on-threads/

All schedule windows below refer to `America/Argentina/Jujuy`, NOT a universal audience-local clock:

- Spanish weekdays: 08:00–11:30, 12:00–13:30, optional 16:00–17:30; weekends: 09:00–11:30.
- English Europe/UK weekday mornings: approximately 04:30–07:30 Argentina time.
- English US Eastern weekday mornings: approximately 10:00–13:00 Argentina time.
- English US Pacific weekday mornings: approximately 13:00–16:00 Argentina time.
- Small evening Spanish exploratory control: 19:30–21:00 only if quality and remaining slots justify it.
- UK/EU and US daylight-saving transitions change offsets. Prefer authoritative audience-local time calculations for each publishing decision, not a permanently fixed conversion.
- English target is **up to three distinct high-quality posts per day** (not a quota), scored >=78 and not republishing the Spanish story in translation.
- The preferred time window is a *secondary* decision after credibility, originality, relevance, and account-specific deduplication. When markets overlap, select the highest-value candidate; ES/EN share runtime spacing and provider budgets.
- Non-breaking jobs should be created by commit with `publish_at` already due in the intended hour. GitHub Actions' push trigger then runs the queue; its six-hour fallback is **not** a precise future scheduler. Do not enqueue a future-dated job and promise delivery at that exact minute.
- Score >=90 verified breaking news may publish at the earliest policy-valid time outside normal windows. Never bypass source checks, topic cooldowns, provider budgets, or the immutable 60-minute gap.
- Investigate the chosen format: text-only for genuine technical discussion; informative visual/card/carrusel only when it adds verified information and is supported by the actual current schema. Do not pretend carousel support is built into the publisher.
- Run a 28-day matched observational trial by language, weekday, category, hook and time; compare confirmed `sent` deliveries only, with >24h metric maturation. Do not force a conclusion when sample sizes are small. Do not raise the configured hard cap automatically.

## Content mix

Use the rolling mix in `config/growth.json` as a directional target across the latest 20 posts:

- breaking/current news;
- explainers that add context;
- discussion posts with a real technical question;
- data/number-driven posts;
- lighter technology observations.

Never create filler merely to satisfy the mix.

## Candidate discovery

Use current public Threads signals when discoverable, plus current primary sources, company announcements, technical documentation and reputable reporting. A viral post is a discovery signal, not a factual source and never copy to be rewritten.

Every factual production job must include at least the configured source count. Prefer primary sources for launches, specifications, security advisories and company announcements.

## Scoring

Score each candidate from 0 to 100 using `config/automation.json`:

- freshness;
- discussion velocity;
- source quality;
- account fit;
- novelty relative to recent posts;
- conversation potential;
- visual potential.

Only enqueue a normal job at or above `min_trend_score`. Treat the higher breaking-news threshold separately.

If evidence is weak, contradictory, stale or mostly recycled engagement bait, do nothing.

## Native Threads topic strategy

Every production post should carry one native Threads topic when Buffer supports it.

Rules:

- exactly zero or one topic; never a pile of hashtags;
- prefer the most specific active topic that truthfully describes the story;
- prefer a specific product/community topic over a broad generic topic when there is real activity around it;
- avoid consecutive reuse of generic topics such as “InteligenciaArtificial” when a better specific topic exists;
- obey the runtime per-topic cooldown and daily cap;
- `content.topic_tag` is mapped by the Buffer provider to `metadata.threads.topic`.

## Deduplication

Before creating a job, inspect recent `jobs/pending` and `jobs/results`.

Do not enqueue:

- the same event twice;
- a materially equivalent angle already used;
- an internal topic still inside the configured cooldown;
- a native Threads topic that violates its cooldown/daily cap;
- a copy variant whose central claim is already represented by a recent result.

The runtime content hash remains the final exact-duplicate defense.

## Copy contract

Write in the language selected by config. The primary language is neutral Spanish; experimental English windows target UK/European and US audience mornings, not an arbitrary Argentina nighttime slot. Never mechanically translate a story already used in the other language: require a materially different angle unless the event is exceptional.

A normal Threads post should:

- lead with the strongest verified fact, contrast or implication;
- explain why it matters without fake urgency;
- add a useful detail, comparison or consequence;
- use a natural question only when it genuinely invites discussion;
- avoid generic CTAs, engagement begging, excessive hashtags and copied viral phrasing;
- stay inside the 500-character runtime limit.

The goal is conversation value, not engagement bait.

## Visual contract

Default to the richer dark editorial renderer. Visuals must add information rather than simply repeat the first sentence.

Good visual inputs include:

- a concise verified headline;
- one useful context line;
- an eyebrow/category;
- the native topic badge;
- descriptive alt text;
- source domains.

Rotate palette and composition so the feed does not look templated. When a native ChatGPT-generated image can be handed off automatically to the publishing pipeline, it may be used; otherwise the deterministic renderer is the reliable fallback.

## Performance learning

Before choosing a new angle, inspect recent PUBLISHED results and metrics.

Record strategy metadata on new jobs when possible:

- `strategy.content_type`;
- `strategy.candidate_score`;
- `strategy.score_breakdown`;
- `strategy.hook_style`;
- `content.topic_tag`.

Learn from a rolling window rather than one viral outlier. Do not materially tune strategy until at least the configured minimum sample is available.

Buffer metrics may lag the source network by about a day, so do not treat 2-hour or 8-hour snapshots as authoritative. Prefer 24-hour-plus comparisons for automated learning.

## Engagement

Replies and comments are strategically important, but automated comment replies must not be invented from an unsupported API surface.

The Buffer provider normalizes Threads comments/replies into the internal `replies` metric. Until a stable, documented reply operation is available for the connected Threads channel, surface meaningful comment activity for manual response rather than pretending the agent can reply safely.

Useful manual replies should add context, answer a question, correct a misconception or ask a genuine follow-up. Avoid empty “thanks” replies at scale.

## Fail-safe behavior

If `config/automation.json` has `enabled=false`, create no jobs.

If credentials or publishing health are uncertain, do not change live state automatically.

`REVIEW` results require inspection and must never be automatically retried.


## Free-tier budgets

The publisher is designed against conservative free-tier headroom rather than provider maxima.

- Buffer Free currently provides 3,000 API requests/month. Keep normal operation below the repository ceilings of 80 authenticated requests/day and 2,400 requests/30 days.
- Buffer Free also permits 10 scheduled posts per channel, but the current runtime keeps future jobs in GitHub and uses Buffer `shareNow` only when due, so those 10 slots are not the current scheduling bottleneck.
- Cloudinary: create media only for jobs that are actually going to publish. The configured conservative media-upload ceiling is shared by generated cards and optional rights-approved source images.
- If a provider budget would be exceeded, leave eligible content queued or omit the optional second image rather than lowering editorial quality, retrying aggressively or incurring paid usage.


## Topic vs no-topic default

Use a native Threads Topic by default.

Meta has publicly stated that posts with tagged topics generally receive more views than posts without one. Therefore the production default is **with topic**, not a 50/50 split.

Selection order:

1. specific active topic that precisely matches the story;
2. specific evergreen topic;
3. broad but still accurate topic;
4. no topic only when there is no honest relevant match.

Do not attach a popular but unrelated topic merely for reach.

After at least 30 published posts with useful metrics, the growth review may reserve roughly 10% of eligible non-breaking posts as a topicless control group so account-specific performance can be compared. Such tests should be matched as closely as practical by content type, quality, time window and visual format. Breaking news should not be sacrificed to the control group.

The goal is not to prove Meta wrong; the control exists to detect whether this account has a materially different pattern.


## Evidence-informed frequency model

The cadence is intentionally opportunity-elastic. Meta has publicly linked higher posting frequency with higher impressions per post while also emphasizing conversation, originality and replies. Large independent datasets also show that more active creators often grow faster, but they do not establish a universal optimal daily count. Therefore the system optimizes both total account growth and per-post quality.

Generic timing data is treated as a prior, not a rule. Weekday audience-local mornings are a strong broad benchmark, while account-specific mature metrics by language, target region, weekday and audience-local hour should progressively override the generic prior.

Multi-post Threads are a future controlled experiment rather than an enabled default. Buffer Free supports them, but the repository must first validate provider payload support and enforce the Free-plan restriction of one scheduled threaded post at a time.


## Breakout taxonomy

Do not collapse every high-performing post into one "winner" category.

A post may be:
- a distribution breakout: views materially exceed the mature rolling median even when replies or conversion remain low;
- an engagement breakout: reactions/reposts/quotes outperform matched posts;
- a conversation breakout: replies materially outperform matched posts;
- a conversion breakout: profile visits or follower gains materially outperform matched posts when those metrics are available.

The Samsung One UI 9 manual insight snapshot is the first explicit distribution-breakout benchmark for this account: 8,063 views from 4,929 viewers, 18 likes, 0 replies, 2 profile visits and 0 followers gained. Most reach came through Instagram rather than the Threads home surface. Treat this as evidence that broad consumer relevance and cross-surface distribution can create reach without proportional conversation or conversion.

Do not copy its wording or over-publish Samsung. Instead test structural traits on genuinely timely comparable stories: large installed-base products, rollout/availability changes, direct user utility, a recognizable product identity, and a concrete question about what users value most. Require repeated matched evidence before changing content mix or cadence.

## Quality upgrade — evidence-first Threads posts (2026-10-21)

This is an editorial decision guide, **not** a change to runtime caps, automation frequency, credentials, provider calls or live scheduler. Apply the stricter of this guide, AGENTS.md, code and configuration. Do not enqueue solely because a candidate passes a copywriting checklist.

### Verify the central claim, not just the bibliography

For each candidate create a short internal claim ledger: (1) the specific news event and announcement time, (2) the strongest publishable claim, (3) who asserts it, (4) primary evidence for that claim, (5) a genuinely independent corroborating report or clearly explain its absence, (6) what is unverified. An official specification validates the specification; it does **not** independently corroborate a third-party order, shipment, security incident or claimed benchmark. Likewise, a newspaper article about a company's unrelated business is not corroboration of its new product.

Require the configured minimum of two reliable, **claim-relevant** source URLs for a production job, with different editorial origins when feasible. If both sources cannot support the central news event, hold the candidate or narrow the central claim to what is actually established; never pad strategy.sources with an unrelated URL. Attribute vendor-funded numbers, unreplicated benchmarks, future availability, preorder values, estimates, predictions, allegations and nonfinal regulatory plans. Distinguish announced vs shipped, demo vs released, API availability vs open weights, vulnerability reports vs confirmed exploits and nominal price vs real cost.

### 3-part post structure and varied endings

Before drafting, explicitly choose **one reader benefit**: does the post change what a user can do, buy, configure, secure, understand or compare? The first sentence should contain the most useful supported fact or contrast; the second should supply a concrete caveat or real-world consequence. The ending should *earn* its space. A question is optional; avoid the habitual generic endings "What do you think?", "Price, speed or quality?" or one more broad question on every article. When a genuine decision exists, ask a specific informed tradeoff question. Otherwise finish with an implication, verification status, practical action, caveat, availability, or measured comparison.

Diversify hooks without inventing data:
- **User impact:** "This Android update changes [specific behavior] for [eligible devices]; here's the rollout limit..."
- **Numerical contrast:** "[Verified numerator] vs [verified comparator]—but both figures cover [different conditions]..."
- **Security action:** "[Confirmed issue] affects [versions/exposure]; [verified mitigation] is available from [date]..."
- **Developer utility:** "[New support] removes [documented integration step], with [documented limitation]..."
- **Evidence check:** "The company reports [claimed gain], but [independent benchmark] has not yet tested [scenario]..."
- **Meaningful discussion:** end with a narrow question only when readers can contribute concrete first-hand experience or make a real technical choice; never fabricate personal experience for the account.

For editorial variety, compare the **last ten confirmed sent posts** before choosing a hook. Avoid repeating the same question template, opening ("X announced...") or closely related category just to reach the daily target. Useful original English posts need independent audience relevance, not translation of an ES story. Optional working-length preference: ~180–360 characters where the core claim fits, while the true supported limit remains 500 Unicode characters.

### Scoring and confidence calibration

Use the seven *exact* fields and maximum weights in `config/automation.json` (15+15+15+15+15+15+10 = 100). Record scores only for observable editorial evidence. In particular, `discussion_velocity` is **zero if reliable, timed conversation observations are missing**; never infer velocity from how notable a brand is, the age of an article or a model's prediction. `candidate_score` must equal the sum of the seven recorded values. Source quality must reflect independence, credibility, relevance to the **central claim** and direct access to evidence; two links alone are not an automatic 15/15. If factual uncertainty is material, reject rather than compensating with other high dimensions. Apply the effective ES/EN and daily escalating thresholds, hard gaps, cooldowns and budgets without modification.

### Informative visuals rather than decorative repetition

Current implemented visual modes are **card** and **none**, not carousel or generative video. Use a card when it clarifies a verified quantity, before/after, product compatibility, security scope or decision matrix and has descriptive `alt_text`. Keep card headline and subheadline complementary to, rather than duplicating, the main post; no fabricated figures, decorative stock photos or clipped screenshots. For highly technical nuance or low media quota, choose intentional text-only `none`. Any external asset requires explicit reuse permission and documented rights; attribution by itself does not grant that permission. Do not spend Cloudinary credits on repeated assets or degrade a validated card automatically when usage cannot be confirmed.

### Adaptive measurement: do not mistake exposure for community

Compare only provider-confirmed `sent` posts with at least 24 hours of metric maturation (also compare 72 hours if available). Track **distribution** (views), **engagement** (likes/reposts/quotes per 1,000 views), **conversation** (replies per 1,000 views), and **conversion** (profile/follow metrics only when available), separately. A post with high views and no replies or follows is a *distribution* result, not proof that its hook grows community. Undefined denominators (0 views) are N/A, not zero engagement. Do not count pending, scheduled, sending, failed or review statuses as published and do not treat a saved PUBLISHED flag without provider `sent` as delivery.

Keep comparisons matched by language, topic, hook, format, audience-local time and age. Account-specific clock times must use real destination time zones and DST. With fewer than 20 comparable mature posts per segment, record only hypotheses; do not promote winning templates, change the global cadence or claim significance from one outlier. Preserve the existing 28-day experiment beginning 2026-10-19 and daily metrics workflow; do not create another scheduled analytics run.

### Conversation after publishing

Buffer's observational Threads dataset found stronger engagement in posts where account owners replied to their comments, but does not establish causation (https://buffer.com/resources/threads-comments-engagement/). When genuine questions are received, prepare a **manual-response opportunity**, with context and evidence, rather than adding an unsupported bot-reply action or making engagement-bait questions. The objective is helpful discussion and trust, not artificial comment volume.

### External research baselines (not account-specific promises)

- Buffer 2026 analysis of 52M+ cross-platform posts: Threads median engagement differed substantially by video/image/text/link format, while formats overlap and observational results should not be treated as causal: https://buffer.com/resources/state-of-social-media-engagement-2026/
- Buffer 2026, 2.5M Threads posts: weekday mornings and midweek were stronger in the sample, but local-audience tests take precedence: https://buffer.com/resources/the-best-time-to-post-on-threads/
- Meta's official Threads topics update: tagged-topic posts generally received more views in Meta's data, not a guarantee for each account: https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/
