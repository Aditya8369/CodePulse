-- PostgreSQL Declarative Range Partitioning Strategy for Activities
-- Solves index bloat and query degradation on massive event timelines

-- 1. Create Partitioned Parent Table
CREATE TABLE IF NOT EXISTS "activities_partitioned" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_partitioned_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- 2. Create Monthly Partitions for 2026
CREATE TABLE IF NOT EXISTS "activities_2026_01" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');

CREATE TABLE IF NOT EXISTS "activities_2026_02" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-02-01 00:00:00') TO ('2026-03-01 00:00:00');

CREATE TABLE IF NOT EXISTS "activities_2026_03" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-03-01 00:00:00') TO ('2026-04-01 00:00:00');

CREATE TABLE IF NOT EXISTS "activities_2026_04" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-04-01 00:00:00') TO ('2026-05-01 00:00:00');

CREATE TABLE IF NOT EXISTS "activities_2026_05" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-05-01 00:00:00') TO ('2026-06-01 00:00:00');

CREATE TABLE IF NOT EXISTS "activities_2026_06" PARTITION OF "activities_partitioned"
    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');

-- 3. Local Partition Indexes for Fast Pruning
CREATE INDEX IF NOT EXISTS "activities_user_idx" ON "activities_partitioned" ("userId", "createdAt" DESC);
