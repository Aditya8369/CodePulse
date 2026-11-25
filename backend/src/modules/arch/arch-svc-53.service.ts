/**
 * Architecture Service 53: High-Availability Failover Sentinel
 * Subsystem: Gateway Routing Tables
 */

export interface UpstreamRoute {
  serviceId: string;
  primaryTarget: string;
  backupTarget: string;
  activeTarget: string;
  consecutiveFailures: number;
  healthy: boolean;
}

export class HaFailoverSentinelService {
  private routes = new Map<string, UpstreamRoute>();
  private readonly failureThreshold: number;

  constructor(failureThreshold = 3) {
    this.failureThreshold = failureThreshold;
  }

  public registerRoute(serviceId: string, primaryTarget: string, backupTarget: string): UpstreamRoute {
    const route: UpstreamRoute = {
      serviceId,
      primaryTarget,
      backupTarget,
      activeTarget: primaryTarget,
      consecutiveFailures: 0,
      healthy: true,
    };
    this.routes.set(serviceId, route);
    return { ...route };
  }

  public recordHealth(serviceId: string, success: boolean): 'UNCHANGED' | 'FAILED_OVER' | 'RECOVERED' {
    const route = this.routes.get(serviceId);
    if (!route) return 'UNCHANGED';

    if (success) {
      route.consecutiveFailures = 0;
      if (route.activeTarget !== route.primaryTarget) {
        route.activeTarget = route.primaryTarget;
        route.healthy = true;
        return 'RECOVERED';
      }
      return 'UNCHANGED';
    }

    route.consecutiveFailures++;
    if (route.consecutiveFailures >= this.failureThreshold && route.activeTarget === route.primaryTarget) {
      route.activeTarget = route.backupTarget;
      route.healthy = false;
      return 'FAILED_OVER';
    }

    return 'UNCHANGED';
  }

  public getActiveTarget(serviceId: string): string | undefined {
    return this.routes.get(serviceId)?.activeTarget;
  }
}
