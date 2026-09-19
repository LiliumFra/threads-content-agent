# Editorial policy

This file defines the operating contract for the recurring ChatGPT trend scout.

## Objective

Publish original, useful technology posts when a current topic has enough evidence and discussion momentum to justify a post. The system should prefer skipping a scan over manufacturing urgency.

## Scope

Primary categories:

- artificial intelligence
- Android
- semiconductors and chips
- robotics
- software and developer tools
- cybersecurity
- major technology companies

Political and electoral content is excluded from this automation.

## Candidate discovery

Use current public Threads signals where discoverable, plus current primary sources, company announcements, technical documentation and reputable reporting. A viral post is a signal, not a source of truth and not copy to be rewritten.

Every factual production job must include at least the configured number of source URLs. Prefer primary sources for product launches, specifications, security advisories and company announcements.

## Scoring

Score each candidate from 0 to 100 with the weights in config/automation.json:

- freshness
- discussion velocity
- source quality
- fit with the technology account
- ability to produce an original angle
- visual potential

Only enqueue a job when the score reaches min_trend_score.

If evidence is weak, contradictory, stale or mostly recycled engagement bait, do nothing.

## Deduplication

Before creating a job, inspect recent files in jobs/pending and jobs/results.

Do not enqueue:

- the same event twice;
- a materially equivalent angle already used;
- a topic still inside the configured publication cooldown;
- a copy variant whose central claim is already represented by a recent result.

The runtime content hash remains the final exact-duplicate defense.

## Copy contract

Write in neutral Spanish unless config says otherwise.

A normal Threads post should:

- lead with the most interesting verified fact or implication;
- explain why it matters without fake urgency;
- provide a useful detail, comparison or consequence;
- use a natural question only when it genuinely invites discussion;
- avoid generic CTAs, engagement begging, excessive hashtags and copied viral phrasing;
- stay inside the runtime 500-character limit.

topic_tag should be used selectively, normally zero or one topic.

## Visual contract

Default to a generated editorial card. The visual should add information rather than repeat the first sentence.

Good card inputs include:

- a concise verified headline;
- one useful context line;
- an eyebrow/category;
- descriptive alt text;
- a source domain footer.

Do not put unsupported numbers or claims into the card.

## Job creation

Create at most max_jobs_per_scan new jobs.

Use a unique filename under:

jobs/pending/

Recommended format:

YYYYMMDD-HHMMSSZ-<short-topic>.json

Set dry_run according to publish_mode:

- dry-run -> true
- live -> false

publish_at must include an explicit offset.

## Learning loop

Before choosing a new angle, inspect recent PUBLISHED results and their metrics when available.

Use performance as a signal, not a command. Do not repeatedly clone a high-performing hook. Prefer learning at the level of useful patterns such as topic, format, timing and information density.

## Fail-safe behavior

If config/automation.json has enabled=false, create no jobs.

If credentials or publishing health are uncertain, do not change the config automatically.

REVIEW results require human inspection and must never be automatically retried.
