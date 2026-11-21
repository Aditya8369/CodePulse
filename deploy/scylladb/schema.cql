-- ==============================================================================
-- CodePulse High-Throughput ScyllaDB / Cassandra Telemetry Schema
-- Optimized for High-Frequency Keystroke Analytics, Match Replay & Cursor Vectors
-- ==============================================================================

-- 1. Create Keyspace with NetworkTopologyStrategy & Multi-DC Replication
CREATE KEYSPACE IF NOT EXISTS codepulse_telemetry
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3
}
AND durable_writes = true;

USE codepulse_telemetry;

-- 2. Partitioned Wide-Column Table for Keystroke & Cursor Time-Series Events
-- Partition Key: ((battle_id, bucket_hour)) - Bounded partition sizes (< 100MB per hour)
-- Clustering Key: (timestamp, event_id) - Strict chronological ordering per battle
-- Compaction: TimeWindowCompactionStrategy (TWCS) - Drops expired SSTables with zero read amplification
CREATE TABLE IF NOT EXISTS codepulse_telemetry.keystroke_events (
  battle_id uuid,
  bucket_hour timestamp,
  timestamp timestamp,
  event_id uuid,
  player_id uuid,
  cursor_x int,
  cursor_y int,
  cursor_offset int,
  char_delta text,
  action_type text,         -- 'KEY_PRESS', 'CURSOR_MOVE', 'PASTE', 'DELETE', 'EXECUTE', 'COMPILATION'
  wpm double,
  latency_ms int,
  metadata map<text, text>,
  PRIMARY KEY ((battle_id, bucket_hour), timestamp, event_id)
) WITH CLUSTERING ORDER BY (timestamp ASC, event_id ASC)
AND compaction = {
  'class': 'TimeWindowCompactionStrategy',
  'compaction_window_size': '1',
  'compaction_window_unit': 'DAYS',
  'timestamp_resolution': 'MILLISECONDS',
  'unchecked_tombstone_compaction': 'true'
}
AND default_time_to_live = 7776000     -- 90-day retention policy (90 * 86400s)
AND gc_grace_seconds = 86400           -- 1 day gc_grace for TWCS tombstone cleanup
AND speculative_retry = '99p'
AND read_repair = 'BLOCKING';

-- 3. Match Telemetry Aggregation Counter Table
-- Tracks running telemetry volume per battle partition without full table scans
CREATE TABLE IF NOT EXISTS codepulse_telemetry.battle_hourly_counters (
  battle_id uuid,
  bucket_hour timestamp,
  total_events counter,
  total_keystrokes counter,
  total_compilations counter,
  PRIMARY KEY (battle_id, bucket_hour)
);

-- 4. Battle Replay Snapshot Manifest
-- Stores indexed time ranges for instant replay scrubbing
CREATE TABLE IF NOT EXISTS codepulse_telemetry.replay_snapshots (
  battle_id uuid,
  start_time timestamp,
  end_time timestamp,
  total_events int,
  participants list<uuid>,
  manifest_uri text,
  PRIMARY KEY (battle_id)
);

