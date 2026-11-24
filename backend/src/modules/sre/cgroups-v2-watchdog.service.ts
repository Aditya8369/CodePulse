export class CGroupsV2WatchdogService {
  public evaluateResourcePressure(usedBytes: number, limitBytes: number): {
    utilizationRatio: number;
    action: 'NORMAL' | 'WARN' | 'THROTTLE';
  } {
    if (limitBytes <= 0) return { utilizationRatio: 0, action: 'NORMAL' };
    const ratio = usedBytes / limitBytes;

    if (ratio >= 0.90) {
      return { utilizationRatio: ratio, action: 'THROTTLE' };
    } else if (ratio >= 0.75) {
      return { utilizationRatio: ratio, action: 'WARN' };
    }

    return { utilizationRatio: ratio, action: 'NORMAL' };
  }
}
