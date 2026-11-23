-- ==============================================================================
-- CodePulse Real-Time High-Throughput Log Analytics Table
-- Engine: MergeTree partitioned by day with ZSTD columnar compression
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS codepulse;

CREATE TABLE IF NOT EXISTS codepulse.codepulse_logs
(
    timestamp DateTime64(3, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
    service LowCardinality(String) CODEC(ZSTD(1)),
    level LowCardinality(String) CODEC(ZSTD(1)),
    trace_id String CODEC(ZSTD(3)),
    user_id String CODEC(ZSTD(3)),
    message String CODEC(ZSTD(3)),
    context_json String CODEC(ZSTD(6)),
    duration_ms Float32 CODEC(ZSTD(1)),
    status_code UInt16 CODEC(ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service, level, toUnixTimestamp(timestamp), trace_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

-- Optimized secondary skip index for fast regex / token searches
ALTER TABLE codepulse.codepulse_logs
    ADD INDEX IF NOT EXISTS idx_message_ngram message TYPE ngrambf_v1(4, 32768, 2, 0) GRANULARITY 1;
