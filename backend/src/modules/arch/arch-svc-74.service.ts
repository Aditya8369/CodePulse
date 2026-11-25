/**
 * Architecture Service 74: Dynamic Resource Governor
 * Subsystem: Sandbox Execution Throttling
 */

export class SandboxResourceGovernorService {
  private activeExecutions = 0;
  private readonly maxNormalCapacity: number;
  private readonly peakThresholdRatio: number;

  constructor(maxNormalCapacity = 10, peakThresholdRatio = 0.8) {
    this.maxNormalCapacity = maxNormalCapacity;
    this.peakThresholdRatio = peakThresholdRatio;
  }

  public requestSandboxSlot(priority: 'NORMAL' | 'HIGH'): { granted: boolean; throttled: boolean } {
    const currentRatio = this.activeExecutions / this.maxNormalCapacity;

    if (currentRatio >= 1.0) {
      if (priority === 'HIGH') {
        this.activeExecutions++;
        return { granted: true, throttled: true };
      }
      return { granted: false, throttled: true };
    }

    if (currentRatio >= this.peakThresholdRatio) {
      this.activeExecutions++;
      return { granted: true, throttled: true }; // throttled warning
    }

    this.activeExecutions++;
    return { granted: true, throttled: false };
  }

  public releaseSlot(): void {
    if (this.activeExecutions > 0) {
      this.activeExecutions--;
    }
  }

  public get activeSlots(): number {
    return this.activeExecutions;
  }
}
