-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisputeVerdict" AS ENUM ('NULLIFY_MATCH', 'AWARD_WIN_TO_VICTIM', 'BAN_CHEATER', 'DISMISS_WITH_PENALTY', 'NO_ACTION');

-- CreateTable
CREATE TABLE IF NOT EXISTS "match_disputes" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "filerId" TEXT NOT NULL,
    "accusedId" TEXT,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "adminVerdict" "DisputeVerdict",
    "adminNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dispute_snapshots" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keystrokeTimeline" JSONB NOT NULL,
    "testCasesStdout" TEXT,
    "testCasesStderr" TEXT,
    "networkRttTelemetry" JSONB,
    "tabFocusLogs" JSONB,
    "finalCodeState" TEXT,

    CONSTRAINT "dispute_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "match_disputes_battleId_idx" ON "match_disputes"("battleId");
CREATE INDEX IF NOT EXISTS "match_disputes_filerId_idx" ON "match_disputes"("filerId");
CREATE INDEX IF NOT EXISTS "match_disputes_status_idx" ON "match_disputes"("status");
CREATE INDEX IF NOT EXISTS "match_disputes_createdAt_idx" ON "match_disputes"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dispute_snapshots_disputeId_idx" ON "dispute_snapshots"("disputeId");
CREATE INDEX IF NOT EXISTS "dispute_snapshots_battleId_idx" ON "dispute_snapshots"("battleId");

-- AddForeignKey
ALTER TABLE "dispute_snapshots" ADD CONSTRAINT "dispute_snapshots_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "match_disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

