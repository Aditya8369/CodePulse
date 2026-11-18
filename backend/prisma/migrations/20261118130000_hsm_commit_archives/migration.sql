-- CreateEnum
CREATE TYPE "StorageTier" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateTable
CREATE TABLE IF NOT EXISTS "commit_archives" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "tier" "StorageTier" NOT NULL DEFAULT 'HOT',
    "originalBytes" INTEGER NOT NULL,
    "compressedBytes" INTEGER NOT NULL,
    "compressionRatio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "storageLocation" TEXT NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commit_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commit_archives_repositoryId_commitSha_key" ON "commit_archives"("repositoryId", "commitSha");
CREATE INDEX IF NOT EXISTS "commit_archives_repositoryId_idx" ON "commit_archives"("repositoryId");
CREATE INDEX IF NOT EXISTS "commit_archives_tier_idx" ON "commit_archives"("tier");
CREATE INDEX IF NOT EXISTS "commit_archives_lastAccessedAt_idx" ON "commit_archives"("lastAccessedAt");

