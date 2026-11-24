export interface KafkaMessagePacket {
  id: string;
  tenantId: string;
  sizeBytes: number;
  payload: any;
}

export interface TenantQueueState {
  tenantId: string;
  quantum: number;
  deficit: number;
  queue: KafkaMessagePacket[];
}

export class KafkaDRRSchedulerService {
  private tenants = new Map<string, TenantQueueState>();
  private activeTenantList: string[] = [];
  private baseQuantum: number;

  constructor(baseQuantumBytes: number = 1024) {
    this.baseQuantum = baseQuantumBytes;
  }

  public registerTenant(tenantId: string, weight: number = 1): void {
    if (!this.tenants.has(tenantId)) {
      this.tenants.set(tenantId, {
        tenantId,
        quantum: Math.max(1, weight) * this.baseQuantum,
        deficit: 0,
        queue: []
      });
      this.activeTenantList.push(tenantId);
    }
  }

  public enqueueMessage(packet: KafkaMessagePacket): void {
    this.registerTenant(packet.tenantId);
    const tenant = this.tenants.get(packet.tenantId)!;
    tenant.queue.push(packet);
  }

  public scheduleRound(maxBatchBytes: number = 4096): KafkaMessagePacket[] {
    const scheduled: KafkaMessagePacket[] = [];
    let scheduledBytes = 0;

    for (const tenantId of this.activeTenantList) {
      const state = this.tenants.get(tenantId);
      if (!state || state.queue.length === 0) {
        if (state) state.deficit = 0; // Reset deficit if empty
        continue;
      }

      state.deficit += state.quantum;

      while (state.queue.length > 0) {
        const nextPacket = state.queue[0];
        if (nextPacket.sizeBytes <= state.deficit) {
          if (scheduledBytes + nextPacket.sizeBytes > maxBatchBytes && scheduled.length > 0) {
            break;
          }
          state.deficit -= nextPacket.sizeBytes;
          scheduled.push(state.queue.shift()!);
          scheduledBytes += nextPacket.sizeBytes;
        } else {
          break;
        }
      }
    }

    return scheduled;
  }

  public getPendingCount(tenantId?: string): number {
    if (tenantId) {
      return this.tenants.get(tenantId)?.queue.length || 0;
    }
    let total = 0;
    for (const state of this.tenants.values()) {
      total += state.queue.length;
    }
    return total;
  }
}
