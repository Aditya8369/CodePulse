/**
 * Architecture Service 26: Service Discovery Heartbeat Watchdog
 * Subsystem: Automated Deregistration
 */

export interface RegisteredService {
  instanceId: string;
  serviceName: string;
  host: string;
  port: number;
  lastHeartbeat: number;
  healthy: boolean;
}

export class ServiceDiscoveryWatchdogService {
  private instances = new Map<string, RegisteredService>();

  private readonly heartbeatTtlMs: number;
  constructor(heartbeatTtlMs = 15000) {
    this.heartbeatTtlMs = heartbeatTtlMs;
  }

  public register(serviceName: string, instanceId: string, host: string, port: number): RegisteredService {
    const inst: RegisteredService = {
      instanceId,
      serviceName,
      host,
      port,
      lastHeartbeat: Date.now(),
      healthy: true,
    };
    this.instances.set(instanceId, inst);
    return { ...inst };
  }

  public recordHeartbeat(instanceId: string, timestamp = Date.now()): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst) return false;
    inst.lastHeartbeat = timestamp;
    inst.healthy = true;
    return true;
  }

  public purgeStaleInstances(currentTime = Date.now()): string[] {
    const deregistered: string[] = [];
    for (const [id, inst] of this.instances.entries()) {
      if (currentTime - inst.lastHeartbeat > this.heartbeatTtlMs) {
        deregistered.push(id);
        this.instances.delete(id);
      }
    }
    return deregistered;
  }

  public getHealthyInstances(serviceName: string): RegisteredService[] {
    return Array.from(this.instances.values()).filter(
      i => i.serviceName === serviceName && i.healthy
    );
  }
}
