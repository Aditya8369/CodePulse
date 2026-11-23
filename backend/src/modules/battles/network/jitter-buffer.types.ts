/**
 * Adaptive Jitter Buffer & Packet Resequencer Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type PacketType = 'KEYSTROKE' | 'CURSOR_MOVE' | 'BATTLE_ACTION' | 'SYNC_FRAME' | 'HEARTBEAT';

export interface KeystrokePacket {
  sequenceNumber: number;
  timestamp: number; // Client transmit timestamp (ms)
  arrivalTimestamp: number; // Server receive timestamp (ms)
  packetType: PacketType;
  battleId: string;
  playerId: string;
  payload: {
    key?: string;
    action?: string;
    cursorPosition?: { line: number; column: number };
    delta?: string;
  };
}

export interface JitterEstimatorState {
  smoothedJitterMs: number;
  smoothedRttMs: number;
  lastTransmitTimeMs: number;
  lastArrivalTimeMs: number;
  interArrivalVariance: number;
  playoutDelayMs: number;
}

export interface JitterBufferConfig {
  minPlayoutDelayMs?: number; // Default 20ms
  maxPlayoutDelayMs?: number; // Default 300ms
  targetFrameRateFps?: number; // Default 60 fps (16.66ms per frame)
  maxBurstJitterMs?: number; // Target benchmark: 200ms
  historyCapacity?: number;
}

export interface PlayoutFrame {
  frameId: number;
  targetPlayoutTimestamp: number;
  packets: KeystrokePacket[];
  isRecoveredGap: boolean;
}

export interface JitterBufferMetrics {
  battleId: string;
  totalPacketsReceived: number;
  outOfOrderPacketsCount: number;
  inOrderPacketsCount: number;
  droppedLatePacketsCount: number;
  currentJitterMs: number;
  currentPlayoutDelayMs: number;
  reorderedFramesCount: number;
  framesReconstructedCount: number;
  averagePacketDelayMs: number;
}
