-- ==============================================================================
-- PostgreSQL Declarative Range Partitioning for audit_logs and battle_submissions
-- NSoC'26 Level 3 Architecture Roadmap (#1058)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Partitioned Parent Table: audit_logs_partitioned
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs_partitioned" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_partitioned_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- 2026 Monthly Partitions for audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs_2026_01" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_02" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-02-01 00:00:00') TO ('2026-03-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_03" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-03-01 00:00:00') TO ('2026-04-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_04" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-04-01 00:00:00') TO ('2026-05-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_05" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-05-01 00:00:00') TO ('2026-06-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_06" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_07" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-07-01 00:00:00') TO ('2026-08-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_08" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_09" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_10" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-10-01 00:00:00') TO ('2026-11-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_11" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-11-01 00:00:00') TO ('2026-12-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_2026_12" PARTITION OF "audit_logs_partitioned"
    FOR VALUES FROM ('2026-12-01 00:00:00') TO ('2027-01-01 00:00:00');

CREATE TABLE IF NOT EXISTS "audit_logs_default" PARTITION OF "audit_logs_partitioned" DEFAULT;

-- Local Partition Indexes for fast pruning on audit_logs
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx" ON "audit_logs_partitioned" ("action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx" ON "audit_logs_partitioned" ("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_target_created_idx" ON "audit_logs_partitioned" ("targetId", "createdAt" DESC);


-- ------------------------------------------------------------------------------
-- 2. Partitioned Parent Table: battle_submissions_partitioned
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "battle_submissions_partitioned" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'typescript',
    "tokensCount" INTEGER NOT NULL DEFAULT 0,
    "fingerprints" TEXT[] NOT NULL DEFAULT '{}',
    "similarityScore" DOUBLE PRECISION,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_submissions_partitioned_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- 2026 Monthly Partitions for battle_submissions
CREATE TABLE IF NOT EXISTS "battle_submissions_2026_01" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_02" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-02-01 00:00:00') TO ('2026-03-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_03" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-03-01 00:00:00') TO ('2026-04-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_04" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-04-01 00:00:00') TO ('2026-05-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_05" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-05-01 00:00:00') TO ('2026-06-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_06" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_07" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-07-01 00:00:00') TO ('2026-08-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_08" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_09" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_10" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-10-01 00:00:00') TO ('2026-11-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_11" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-11-01 00:00:00') TO ('2026-12-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_2026_12" PARTITION OF "battle_submissions_partitioned"
    FOR VALUES FROM ('2026-12-01 00:00:00') TO ('2027-01-01 00:00:00');

CREATE TABLE IF NOT EXISTS "battle_submissions_default" PARTITION OF "battle_submissions_partitioned" DEFAULT;

-- Local Partition Indexes for fast pruning on battle_submissions
CREATE INDEX IF NOT EXISTS "battle_submissions_battle_created_idx" ON "battle_submissions_partitioned" ("battleId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "battle_submissions_user_created_idx" ON "battle_submissions_partitioned" ("userId", "createdAt" DESC);


-- ------------------------------------------------------------------------------
-- 3. Automated Partition Creation via Stored Procedure & pg_cron
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_next_month_partitions()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    next_month_start DATE := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    next_month_end DATE := date_trunc('month', CURRENT_DATE + INTERVAL '2 months');
    year_month TEXT := to_char(next_month_start, 'YYYY_MM');
    audit_table_name TEXT := 'audit_logs_' || year_month;
    sub_table_name TEXT := 'battle_submissions_' || year_month;
BEGIN
    -- Dynamically generate next month partition for audit_logs
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs_partitioned" FOR VALUES FROM (%L) TO (%L);',
        audit_table_name, next_month_start, next_month_end
    );

    -- Dynamically generate next month partition for battle_submissions
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF "battle_submissions_partitioned" FOR VALUES FROM (%L) TO (%L);',
        sub_table_name, next_month_start, next_month_end
    );

    RAISE NOTICE 'Successfully provisioned monthly partitions for %: % and %', year_month, audit_table_name, sub_table_name;
END;
$$;

-- pg_cron schedule running on the 25th of every month at midnight (00:00 UTC)
-- To enable pg_cron in PostgreSQL:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('auto_partition_maintenance', '0 0 25 * *', 'SELECT create_next_month_partitions();');


-- ------------------------------------------------------------------------------
-- 4. Verification & Partition Pruning Demonstration (EXPLAIN ANALYZE)
-- ------------------------------------------------------------------------------
-- Example Query targeting November 2026 logs:
-- EXPLAIN (ANALYZE, COSTS OFF)
-- SELECT * FROM "audit_logs_partitioned"
-- WHERE "createdAt" >= '2026-11-01' AND "createdAt" < '2026-11-30';
-- -> Scans ONLY "audit_logs_2026_11" (Partitions 2026_01 - 2026_10 pruned away entirely).
