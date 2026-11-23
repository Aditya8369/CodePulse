-- ==============================================================================
-- PostgreSQL Logical Replication & PL/pgSQL Change Data Capture (CDC) Trigger
-- NSoC'26 Level 3 Architecture Roadmap (#1065)
-- ==============================================================================

-- 1. Create Logical Replication Slot for external Debezium/WAL stream
-- SELECT pg_create_logical_replication_slot('codepulse_cdc_slot', 'wal2json');

-- 2. Generic PL/pgSQL CDC Trigger Function Capturing Row-Level Mutations
CREATE OR REPLACE FUNCTION fn_cdc_row_mutation_publisher()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    cdc_payload JSONB;
    before_state JSONB := NULL;
    after_state JSONB := NULL;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        before_state := to_jsonb(OLD);
        after_state := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        before_state := to_jsonb(OLD);
    ELSIF (TG_OP = 'INSERT') THEN
        after_state := to_jsonb(NEW);
    END IF;

    cdc_payload := jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'schema', TG_TABLE_SCHEMA,
        'before', before_state,
        'after', after_state,
        'timestamp', CURRENT_TIMESTAMP,
        'txId', txid_current()
    );

    -- Publish row mutation event to PostgreSQL NOTIFY channel
    PERFORM pg_notify('codepulse_cdc_stream', cdc_payload::text);

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 3. Attach CDC Triggers to Core Mission-Critical Tables

-- Trigger for battle_ratings (Real-Time Leaderboard Cache Invalidation)
DROP TRIGGER IF EXISTS trg_cdc_battle_ratings ON "battle_ratings";
CREATE TRIGGER trg_cdc_battle_ratings
AFTER INSERT OR UPDATE OR DELETE ON "battle_ratings"
FOR EACH ROW EXECUTE FUNCTION fn_cdc_row_mutation_publisher();

-- Trigger for battles (Active Match State Tracking)
DROP TRIGGER IF EXISTS trg_cdc_battles ON "battles";
CREATE TRIGGER trg_cdc_battles
AFTER INSERT OR UPDATE OR DELETE ON "battles"
FOR EACH ROW EXECUTE FUNCTION fn_cdc_row_mutation_publisher();

-- Trigger for users (Profile / Authentication Revocation Sync)
DROP TRIGGER IF EXISTS trg_cdc_users ON "users";
CREATE TRIGGER trg_cdc_users
AFTER INSERT OR UPDATE OR DELETE ON "users"
FOR EACH ROW EXECUTE FUNCTION fn_cdc_row_mutation_publisher();
