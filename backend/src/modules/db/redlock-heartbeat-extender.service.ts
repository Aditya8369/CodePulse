export interface LockLease {
  lockKey: string;
  leaseExpiresAtMs: number;
  leaseTtlMs: number;
  active: boolean;
}

export class RedlockHeartbeatExtenderService {
  private leases = new Map<string, LockLease>();

  public acquireLease(lockKey: string, ttlMs: number = 5000): LockLease {
    const lease: LockLease = {
      lockKey,
      leaseExpiresAtMs: Date.now() + ttlMs,
      leaseTtlMs: ttlMs,
      active: true
    };
    this.leases.set(lockKey, lease);
    return lease;
  }

  public renew(lockKey: string): boolean {
    const lease = this.leases.get(lockKey);
    if (!lease || !lease.active) return false;
    lease.leaseExpiresAtMs = Date.now() + lease.leaseTtlMs;
    return true;
  }

  public release(lockKey: string): void {
    const lease = this.leases.get(lockKey);
    if (lease) lease.active = false;
    this.leases.delete(lockKey);
  }
}
