/**
 * Reactive Stream Backpressure & SSD Ring Buffer Spilling Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type BackpressureSignal = 'HEALTHY' | 'THROTTLE' | 'SPILL_TO_DISK' | 'DROP_NON_CRITICAL';

export interface StreamChunk<T = unknown> {
  id: string;
  data: T;
  sizeBytes: number;
  priority: 'CRITICAL' | 'NORMAL' | 'LOW';
  createdAt: number;
}

export interface BackpressureMetrics {
  currentQueueLength: number;
  memoryBufferUsageBytes: number;
  spilledToDiskBytes: number;
  spilledChunksCount: number;
  activeSignal: BackpressureSignal;
  totalIngested: number;
  totalDrained: number;
}
