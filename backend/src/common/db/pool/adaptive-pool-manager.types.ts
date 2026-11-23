/**
 * Adaptive Connection Pool Multiplexer & Reservation Guard Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type PoolClientCategory = 'BATTLE_CRITICAL' | 'REALTIME_SYNC' | 'BACKGROUND_ANALYTICS';

export interface PoolReservationConfig {
  totalConnections?: number;
  battleReservedRatio?: number; // 60% dedicated to battles
  analyticsMaxRatio?: number; // Max 15% for background analytics
  acquisitionTimeoutMs?: number;
}

export interface PoolConnectionLease {
  leaseId: string;
  category: PoolClientCategory;
  connectionId: number;
  acquiredAt: number;
  released: boolean;
}

export interface PoolMetrics {
  totalCapacity: number;
  activeLeases: number;
  battleReservedCapacity: number;
  battleActiveLeases: number;
  analyticsActiveLeases: number;
  queuedRequestsCount: number;
  throttledAnalyticsCount: number;
  averageAcquisitionLatencyMs: number;
}
