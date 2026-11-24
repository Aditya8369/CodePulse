export class DynamicAdaptiveShedderService {
  private p99ThresholdMs: number = 300;

  public shouldShed(currentP99LatencyMs: number, isCriticalPath: boolean): boolean {
    if (isCriticalPath) {
      return false; // Never shed critical auth/submission paths
    }

    return currentP99LatencyMs > this.p99ThresholdMs;
  }
}
