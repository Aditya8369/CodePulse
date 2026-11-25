/**
 * Architecture Service 57: Lightweight Distributed Semaphore Coordinator
 * Subsystem: Bounded Concurrency Operations
 */

export class DistributedSemaphoreService {
  private holders = new Map<string, Set<string>>(); // resource -> Set of permit holders
  private readonly maxPermits: number;

  constructor(maxPermits = 5) {
    this.maxPermits = maxPermits;
  }

  public acquirePermit(resourceId: string, clientId: string): boolean {
    let set = this.holders.get(resourceId);
    if (!set) {
      set = new Set();
      this.holders.set(resourceId, set);
    }

    if (set.has(clientId)) return true;
    if (set.size >= this.maxPermits) return false;

    set.add(clientId);
    return true;
  }

  public releasePermit(resourceId: string, clientId: string): boolean {
    const set = this.holders.get(resourceId);
    if (!set || !set.has(clientId)) return false;
    set.delete(clientId);
    return true;
  }

  public availablePermits(resourceId: string): number {
    const set = this.holders.get(resourceId);
    return this.maxPermits - (set ? set.size : 0);
  }
}
