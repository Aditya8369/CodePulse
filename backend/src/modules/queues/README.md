# Background queue recovery (#330)

Challenges, leaderboard sync and daily GitHub sync share a policy of three attempts
with exponential backoff (1s, 2s). Daily user sync now enqueues bounded per-user
jobs; failures propagate to BullMQ instead of disappearing inside a cron loop.

Terminal failures are copied to the unprocessed `dead-letter` queue, preserving
original data, stack, source id and timestamp. Source failed jobs remain retained,
so storage outages cannot erase the recovery record. Oversized (>1 MiB) or
unserializable payloads remain in the source failed queue for operator recovery.
The DLQ is not a worker: poison messages are never automatically executed there.

Optional `DLQ_DISCORD_WEBHOOK_URL` accepts an HTTPS discord.com webhook URL.
Alerts include the DLQ id and worker metadata, with payload values and raw errors
redacted because job arguments can contain tokens. Alert delivery is best effort;
its failure cannot discard a quarantine. A Redis Lua operation counts each source
job once across worker processes before attempting an alert.

Set `QUEUE_ADMIN_USER_IDS` to comma-separated authenticated application user ids.
Without it, both administrator endpoints fail closed:

- `POST /api/v1/admin/queues/dlq/replay`, body `{ "ids": ["<64-hex-id>"] }`.
  Up to 20 ids; repeated ids coalesce. Replays target only the three known source
  queues with a stable replay id. Completion records are retained to prevent
  repeated/concurrent replay requests from executing the same recovery twice.
  Failed replay jobs require operator inspection; the endpoint does not silently
  grant a fresh retry budget on every request. Business tasks must still tolerate
  at-least-once delivery, as with normal BullMQ retries.
- `GET /api/v1/admin/queues/metrics` returns raw Prometheus text containing the
  persisted `bullmq_dead_letter_jobs_total` counter.

Inspect protected Redis using the configured queue administration tools to select
DLQ ids. Treat payloads and stacks as sensitive. Operator retention/cleanup must
preserve replay job ids while their DLQ entries remain replayable; deleting those
ids removes the idempotency guarantee. Keep Redis persistence and access controls
enabled. This contribution does not create or modify live queue/admin settings.

From backend: `npm test -- --runInBand src/modules/queues src/modules/sync/sync.worker.spec.ts`,
then `npm run build`. Tests mock queues/Redis and Discord; they do not send alerts.
AI-assisted with Codex.
