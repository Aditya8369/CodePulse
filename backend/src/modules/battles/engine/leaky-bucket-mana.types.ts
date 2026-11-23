/**
 * Distributed Leaky Bucket Mutex & Atomic Resource Depletion Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type ResourceType = 'MANA' | 'STAMINA' | 'SPELL_COOLDOWN' | 'COMBO_POINTS';

export interface ResourceBucketState {
  playerId: string;
  resource: ResourceType;
  capacity: number; // Maximum burst units
  leakRateUnitsPerSec: number; // Continuous leak / replenishment rate
  waterLevel: number; // Current consumed capacity
  lastLeakTimestampMs: number;
  lockFencingToken: number;
}

export interface ResourceDepletionRequest {
  playerId: string;
  battleId: string;
  resource: ResourceType;
  amount: number;
  burstCapacity?: number;
  leakRatePerSec?: number;
  actionName?: string;
}

export interface ResourceDepletionResult {
  allowed: boolean;
  remainingCapacity: number;
  currentWaterLevel: number;
  leakTimeRemainingMs: number;
  fencingToken: number;
  latencyMs: number;
  rejectionReason?: string;
}

export interface LeakyBucketConfig {
  defaultCapacity?: number;
  defaultLeakRatePerSec?: number;
  lockTimeoutMs?: number;
}

export interface LeakyBucketMetrics {
  totalDepletionRequests: number;
  successfulDepletions: number;
  throttledRequests: number;
  averageExecutionLatencyMs: number;
  peakWaterLevel: number;
}
