# Editorial policy

This file defines the operating contract for the recurring ChatGPT trend scout.

## Objective

Grow the account through original, useful technology content that earns attention and conversation without turning the feed into an RSS mirror. The system should prefer skipping a weak scan over manufacturing urgency.

The growth strategy is defined in `config/growth.json`. Runtime safety limits are defined in `config/policy.json`.

## Publishing cadence

- Target: 3 posts per day.
- Soft maximum: 4 posts per day when there are enough strong stories.
- Hard maximum: 5 posts per day.
- Scan for new developments every 3 hours.
- Standard spacing: about 105 minutes.
- Runtime minimum spacing: 75 minutes.
- Breaking news scoring at least the configured breaking-news threshold may publish immediately rather than waiting for a preferred window, but never bypasses the hard daily cap.

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

Write in neutral Spanish unless config says otherwise.

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

Current Buffer documentation exposes normalized Threads replies as `comments` in post metrics and experimental engagement capability metadata. Until a stable, documented reply operation is available for the connected Threads channel, surface meaningful comment activity for manual response rather than pretending the agent can reply safely.

Useful manual replies should add context, answer a question, correct a misconception or ask a genuine follow-up. Avoid empty “thanks” replies at scale.

## Fail-safe behavior

If `config/automation.json` has `enabled=false`, create no jobs.

If credentials or publishing health are uncertain, do not change live state automatically.

`REVIEW` results require inspection and must never be automatically retried.
