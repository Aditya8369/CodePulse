import { Injectable, Logger, OnModuleDestroy, Optional, ServiceUnavailableException } from '@nestjs/common';
import { PoolClientCategory, PoolConnectionLease, PoolMetrics, PoolReservationConfig } from './adaptive-pool-manager.types';

@Injectable()
export class AdaptivePoolManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(AdaptivePoolManagerService.name);

  private readonly totalConnections: number;
  private readonly battleReservedRatio: number;
  private readonly analyticsMaxRatio: number;
  private readonly acquisitionTimeoutMs: number;

  private activeConnections = new Map<string, PoolConnectionLease>();
  private battleReservedCount: number;
  private analyticsMaxCount: number;
  private connectionCounter = 0;
  private totalAcquisitions = 0;
  private totalAcquisitionLatencyMs = 0;
  private throttledAnalyticsCount = 0;

  constructor(@Optional() config?: PoolReservationConfig) {
    this.totalConnections = config?.totalConnections ?? 50;
    this.battleReservedRatio = config?.battleReservedRatio ?? 0.6; // 60% = 30 connections for battles
    this.analyticsMaxRatio = config?.analyticsMaxRatio ?? 0.15; // 15% = 7 connections for analytics
    this.acquisitionTimeoutMs = config?.acquisitionTimeoutMs ?? 5000;

    this.battleReservedCount = Math.floor(this.totalConnections * this.battleReservedRatio);
    this.analyticsMaxCount = Math.floor(this.totalConnections * this.analyticsMaxRatio);
  }

  public onModuleDestroy(): void {
    this.activeConnections.clear();
  }

  /**
   * Acquires a database connection lease with category priority and quota reservation.
   * Throttles background analytics during live competitive match traffic.
   */
  public async acquireLease(category: PoolClientCategory): Promise<PoolConnectionLease> {
    const start = performance.now();
    this.totalAcquisitions++;

    const currentTotal = this.activeConnections.size;
    let categoryActive = 0;
    for (const lease of this.activeConnections.values()) {
      if (lease.category === category) categoryActive++;
    }

    // Check Analytics Quota
    if (category === 'BACKGROUND_ANALYTICS') {
      if (categoryActive >= this.analyticsMaxCount || currentTotal >= this.totalConnections - this.battleReservedCount) {
        this.throttledAnalyticsCount++;
        throw new ServiceUnavailableException(
          `[DB-Pool-Throttle] Background analytics job throttled to reserve dedicated connections for live battles (${categoryActive}/${this.analyticsMaxCount} in use).`,
        );
      }
    }

    // Check Total Capacity
    if (currentTotal >= this.totalConnections) {
      throw new ServiceUnavailableException(
        `[DB-Pool-Exhausted] Total pool capacity of ${this.totalConnections} reached.`,
      );
    }

    this.connectionCounter++;
    const leaseId = `lease-${this.connectionCounter}-${Date.now()}`;
    const lease: PoolConnectionLease = {
      leaseId,
      category,
      connectionId: this.connectionCounter,
      acquiredAt: Date.now(),
      released: false,
    };

    this.activeConnections.set(leaseId, lease);
    const latency = performance.now() - start;
    this.totalAcquisitionLatencyMs += latency;

    return lease;
  }

  public releaseLease(leaseId: string): boolean {
    const lease = this.activeConnections.get(leaseId);
    if (lease) {
      lease.released = true;
      this.activeConnections.delete(leaseId);
      return true;
    }
    return false;
  }

  public getMetrics(): PoolMetrics {
    let battleActive = 0;
    let analyticsActive = 0;

    for (const lease of this.activeConnections.values()) {
      if (lease.category === 'BATTLE_CRITICAL') battleActive++;
      if (lease.category === 'BACKGROUND_ANALYTICS') analyticsActive++;
    }

    const avg = this.totalAcquisitions > 0 ? this.totalAcquisitionLatencyMs / this.totalAcquisitions : 0;

    return {
      totalCapacity: this.totalConnections,
      activeLeases: this.activeConnections.size,
      battleReservedCapacity: this.battleReservedCount,
      battleActiveLeases: battleActive,
      analyticsActiveLeases: analyticsActive,
      queuedRequestsCount: 0,
      throttledAnalyticsCount: this.throttledAnalyticsCount,
      averageAcquisitionLatencyMs: Math.round(avg * 100) / 100,
    };
  }
}
