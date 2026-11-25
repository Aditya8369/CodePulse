/**
 * Architecture Service 18: Adaptive Memory Allocation Governor
 * Subsystem: High-Concurrency Compilation Requests
 */

export interface MemoryReservation {
  taskId: string;
  allocatedBytes: number;
  timestamp: number;
}

export class AdaptiveMemoryGovernorService {
  private allocatedBytes = 0;
  private reservations = new Map<string, MemoryReservation>();

  private readonly maxHeapBytes: number;
  private readonly throttleThresholdRatio: number;
  private readonly shedThresholdRatio: number;

  constructor(
    maxHeapBytes = 512 * 1024 * 1024,
    throttleThresholdRatio = 0.75,
    shedThresholdRatio = 0.90
  ) {
    this.maxHeapBytes = maxHeapBytes;
    this.throttleThresholdRatio = throttleThresholdRatio;
    this.shedThresholdRatio = shedThresholdRatio;
  }

  public requestAllocation(taskId: string, bytes: number): { granted: boolean; reason: string; headroom: number } {
    const projectedUsage = this.allocatedBytes + bytes;
    const ratio = projectedUsage / this.maxHeapBytes;

    if (ratio > this.shedThresholdRatio) {
      return {
        granted: false,
        reason: 'CRITICAL_HEAP_EXHAUSTION_SHEDDING',
        headroom: Math.max(0, this.maxHeapBytes - this.allocatedBytes),
      };
    }

    this.allocatedBytes += bytes;
    this.reservations.set(taskId, {
      taskId,
      allocatedBytes: bytes,
      timestamp: Date.now(),
    });

    const isThrottled = ratio > this.throttleThresholdRatio;
    return {
      granted: true,
      reason: isThrottled ? 'GRANTED_WITH_THROTTLE_WARNING' : 'GRANTED_OPTIMAL',
      headroom: this.maxHeapBytes - this.allocatedBytes,
    };
  }

  public releaseAllocation(taskId: string): number {
    const res = this.reservations.get(taskId);
    if (!res) return 0;

    this.allocatedBytes = Math.max(0, this.allocatedBytes - res.allocatedBytes);
    this.reservations.delete(taskId);
    return res.allocatedBytes;
  }

  public getHeadroom(): number {
    return Math.max(0, this.maxHeapBytes - this.allocatedBytes);
  }

  public getUsageRatio(): number {
    return this.allocatedBytes / this.maxHeapBytes;
  }
}
