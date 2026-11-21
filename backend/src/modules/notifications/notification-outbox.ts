import { NotificationType, Prisma } from '@prisma/client';

export interface NotificationEvent {
  eventKey: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

/** Call with the same transaction client as the business mutation. The update is
 * intentionally empty: replay must not mutate an event's original payload. */
export function enqueueNotification(
  tx: Prisma.TransactionClient,
  event: NotificationEvent,
) {
  if (
    !event.eventKey.trim() ||
    event.eventKey.length > 200 ||
    !event.title.trim() ||
    event.title.length > 500 ||
    !event.message.trim() ||
    event.message.length > 4000 ||
    !event.userId ||
    !Object.values(NotificationType).includes(event.type)
  ) {
    throw new Error('Invalid notification event');
  }
  return tx.notificationOutbox.upsert({
    where: {
      eventKey_userId: { eventKey: event.eventKey, userId: event.userId },
    },
    create: event,
    update: {},
  });
}

// Static SQL and bound parameters; expired leases are eligible for recovery.
export const CLAIM_NOTIFICATION_SQL = `
WITH candidates AS (
  SELECT id FROM notification_outbox
  WHERE attempts < $5 AND (
    (status = 'PENDING' AND "nextAttemptAt" <= $1) OR
    (status = 'PROCESSING' AND "leaseExpiresAt" <= $1)
  )
  ORDER BY "createdAt", id
  LIMIT $4
  FOR UPDATE SKIP LOCKED
)
UPDATE notification_outbox AS outbox
SET status = 'PROCESSING', attempts = attempts + 1,
    "leaseToken" = $3, "leaseExpiresAt" = $2
FROM candidates WHERE outbox.id = candidates.id
RETURNING outbox.*`;

export const MAX_NOTIFICATION_ATTEMPTS = 5;
