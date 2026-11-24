export class EventLoopGCWatchdogService {
  private maxLagMs: number = 50;

  public evaluateLag(measuredLagMs: number): { isBlocked: boolean; severity: 'HEALTHY' | 'WARN' | 'CRITICAL' } {
    if (measuredLagMs > 200) {
      return { isBlocked: true, severity: 'CRITICAL' };
    } else if (measuredLagMs > this.maxLagMs) {
      return { isBlocked: false, severity: 'WARN' };
    }
    return { isBlocked: false, severity: 'HEALTHY' };
  }
}
