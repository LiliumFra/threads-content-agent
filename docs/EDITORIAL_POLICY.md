# Editorial policy

This file defines the operating contract for the recurring ChatGPT trend scout.

## Objective

Grow the account through original, useful technology content that earns attention and conversation without turning the feed into an RSS mirror. The system should prefer skipping a weak scan over manufacturing urgency.

The growth strategy is defined in `config/growth.json`. Runtime safety limits are defined in `config/policy.json`.

## Publishing cadence

- Base target: 5 posts per day when enough strong independent stories exist.
- Normal elastic capacity: up to 8 posts per day.
- Configured hard ceiling: 16 posts per day, exclusively when the effective policy and runtime gates agree. This is capacity, never a quota; posts 13–16 are reserved for genuinely exceptional independently verified news.
- Scan for new developments every hour.
- Standard spacing: about 75 minutes.
- Runtime minimum spacing: 60 minutes.
- The quality threshold rises with volume: score 72 through post 5, 78 through post 8, 84 through post 10, 90 for posts 11–12, and 94 for posts 13–16. Respect the strictest persisted policy/configuration; no automatic hard-cap increases.
- Count pending jobs toward daily capacity so a busy scan cannot silently overbook later slots.
- If mature matched samples show declining per-post quality, the adaptive controller should reduce target volume rather than defend a posting quota.
- Breaking news scoring at least the configured breaking-news threshold may take the earliest policy-valid slot rather than waiting for a preferred window, but never bypasses the hard daily cap or API budgets.

Preferred local windows are stored in `config/growth.json`. They are guidance for normal posts, not a reason to delay genuinely time-sensitive news.

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

Write in the language selected by config. The default daytime language is neutral Spanish; the configured nighttime experiment uses English. Never mechanically translate a story already used in the other language: require a materially different angle unless the event is exceptional.

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

Account-specific breakout measurements, screenshots, channel analytics and conversion counts belong in private runtime storage, not in a public code repository. Distinguish reach from meaningful engagement when evaluating new editorial approaches.

Do not copy the wording of past high-performing posts or repeatedly over-publish a single brand. Instead test structural traits on genuinely timely comparable stories: large installed-base products, rollout/availability changes, direct user utility, a recognizable product identity, and a concrete question about what users value most. Require repeated matched evidence before changing content mix or cadence.
