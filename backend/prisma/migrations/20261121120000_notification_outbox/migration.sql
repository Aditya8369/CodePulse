CREATE TABLE "notification_outbox" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_outbox_status_check" CHECK ("status" IN ('PENDING','PROCESSING','DELIVERED','FAILED')),
  CONSTRAINT "notification_outbox_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "notification_outbox_payload_check" CHECK (
    length("eventKey") BETWEEN 1 AND 200 AND length("title") BETWEEN 1 AND 500 AND length("message") BETWEEN 1 AND 4000
  )
);
CREATE UNIQUE INDEX "notification_outbox_eventKey_userId_key" ON "notification_outbox"("eventKey","userId");
CREATE INDEX "notification_outbox_status_nextAttemptAt_idx" ON "notification_outbox"("status","nextAttemptAt");
CREATE INDEX "notification_outbox_status_leaseExpiresAt_idx" ON "notification_outbox"("status","leaseExpiresAt");
