# Intraday batch policy

Each trend scan may enqueue up to 3 distinct technology stories.

## Limits

- Maximum per scan: 3
- Repository daily publication cap: 5
- Minimum interval between published posts: 75 minutes
- Batch spacing target: 90 minutes
- Trend scan cadence: every 4 hours

The scout must count today's already-published results plus pending jobs scheduled for today before enqueueing. It may only create as many jobs as remain under the daily cap.

## Timing

When 3 stories qualify in the same scan:

1. Story A: publish immediately.
2. Story B: publish about 90 minutes later.
3. Story C: publish about 180 minutes later.

If only 2 qualify, use the first two slots. If only 1 qualifies, create one job.

The hourly queue-recovery workflow processes future-dated pending jobs when their publish_at time becomes due. The initial job-file push still triggers the queue immediately.

## Quality

Do not fill all three slots artificially. Three is a ceiling, not a target. Every story must independently meet min_trend_score, source verification, freshness, deduplication, and editorial requirements.
