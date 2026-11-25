/**
 * Architecture Service 69: Distributed Leader Election Lease Renewer
 * Subsystem: Network Partition Fail-Safe
 */

export class LeaderElectionLeaseRenewerService {
  private leaderId: string | null = null;
  private leaseExpiry = 0;
  private readonly leaseDurationMs: number;

  constructor(leaseDurationMs = 5000) {
    this.leaseDurationMs = leaseDurationMs;
  }

  public acquireOrRenewLease(candidateId: string, now = Date.now()): boolean {
    if (this.leaderId === null || now >= this.leaseExpiry) {
      // Lease expired or unowned
      this.leaderId = candidateId;
      this.leaseExpiry = now + this.leaseDurationMs;
      return true;
    }

    if (this.leaderId === candidateId) {
      // Leader renews lease
      this.leaseExpiry = now + this.leaseDurationMs;
      return true;
    }

    return false; // Held by another active leader
  }

  public isLeader(nodeId: string, now = Date.now()): boolean {
    return this.leaderId === nodeId && now < this.leaseExpiry;
  }
}
