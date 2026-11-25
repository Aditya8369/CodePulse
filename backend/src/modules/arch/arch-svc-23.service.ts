/**
 * Architecture Service 23: Lightweight Distributed Lock with Fencing Tokens
 * Subsystem: Fencing Token Validation Against Stale Mutations
 */

export interface DistributedLock {
  resourceId: string;
  holderId: string;
  fencingToken: bigint;
  expiresAt: number;
}

export class DistributedLockFencingTokenService {
  private currentLock: DistributedLock | null = null;
  private tokenSequence = 0n;
  private highestCommittedToken = 0n;

  public acquireLock(resourceId: string, holderId: string, ttlMs = 5000): DistributedLock | null {
    const now = Date.now();
    if (this.currentLock && this.currentLock.expiresAt > now) {
      if (this.currentLock.holderId !== holderId) {
        return null; // Lock held by another process
      }
    }

    this.tokenSequence += 1n;
    this.currentLock = {
      resourceId,
      holderId,
      fencingToken: this.tokenSequence,
      expiresAt: now + ttlMs,
    };
    return { ...this.currentLock };
  }

  public validateAndCommitMutation(fencingToken: bigint): boolean {
    // Stale mutation check: token must be strictly greater than highest committed token
    if (fencingToken <= this.highestCommittedToken) {
      return false;
    }
    this.highestCommittedToken = fencingToken;
    return true;
  }

  public releaseLock(resourceId: string, holderId: string): boolean {
    if (this.currentLock && this.currentLock.resourceId === resourceId && this.currentLock.holderId === holderId) {
      this.currentLock = null;
      return true;
    }
    return false;
  }
}
