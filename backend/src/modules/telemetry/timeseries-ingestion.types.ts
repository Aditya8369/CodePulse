/**
 * TimescaleDB Hypertable Time-Series Telemetry Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface KeystrokeTelemetryPoint {
  time: number; // Unix microsecond timestamp
  matchId: string;
  playerId: string;
  keyChar: string;
  flightTimeMs: number;
  holdTimeMs: number;
  pressureLevel: number;
}

export interface HypertableChunkMetrics {
  totalPointsIngested: number;
  activeChunkCount: number;
  compressionRatio: number;
  averageIngestionDurationMicroseconds: number;
}
