/**
 * Architecture Service 58: Microservice Dependency Degradation Monitor
 * Subsystem: Partial Feature Flag Tripping
 */

export class DependencyDegradationMonitorService {
  private featureStates = new Map<string, boolean>(); // featureName -> enabled
  private dependencyFailures = new Map<string, number>();
  private readonly failureThreshold: number;

  constructor(failureThreshold = 3) {
    this.failureThreshold = failureThreshold;
  }

  public registerFeatureBinding(featureName: string): void {
    this.featureStates.set(featureName, true);
  }

  public recordDependencyFailure(dependencyName: string, affectedFeature: string): boolean {
    const count = (this.dependencyFailures.get(dependencyName) || 0) + 1;
    this.dependencyFailures.set(dependencyName, count);

    if (count >= this.failureThreshold) {
      this.featureStates.set(affectedFeature, false);
      return true; // feature tripped off
    }
    return false;
  }

  public isFeatureEnabled(featureName: string): boolean {
    return this.featureStates.get(featureName) ?? false;
  }
}
