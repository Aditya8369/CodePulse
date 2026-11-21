# Transactional notification outbox

Deploy the notification-outbox Prisma migration before starting this application
version. Level-up and challenge-completion producers now enqueue in the same
transaction as their domain writes. Existing producers that already create an
inbox row within their domain transaction remain valid; migrate additional event
types with a stable business event key using enqueueNotification(tx, event).

eventKey plus userId identifies one immutable event/recipient. The scheduler
claims at most 25 rows every two seconds with PostgreSQL FOR UPDATE SKIP LOCKED.
Each claim has a 60-second lease and increments its attempt count. Inbox creation
and the fenced DELIVERED update share one transaction. The inbox primary key is
the outbox ID; replay never changes isRead or the original payload.

Failures use bounded exponential backoff, with five attempts before FAILED.
Expired final leases become FAILED. Error text is generic to avoid storing SQL
parameters or notification bodies in diagnostics. User deletion cascades outbox
records; there is no public retry endpoint.

## Operator commands

From backend with the explicitly selected DATABASE_URL and DIRECT_URL:

```sh
npx ts-node scripts/notification-outbox.ts
npx ts-node scripts/notification-outbox.ts --retry <failed-event-id>
npx ts-node scripts/notification-outbox.ts --drain
```

The default command lists at most 25 failed events without message bodies.
Retry resets only FAILED rows and preserves the original event/inbox key.
The scheduled worker picks the event up after repair. These commands require
operator database access and are not exposed to normal application users.
