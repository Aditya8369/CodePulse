import { Injectable } from '@nestjs/common';

export interface ActiveAdvisoryLock {
  lockKey: number;
  acquiredAt: number;
  timeoutMs: number;
}

@Injectable()
export class PostgresAdvisoryDeadlockGuardService {
  private readonly activeLocks = new Map<number, ActiveAdvisoryLock>();
  private readonly defaultTimeoutMs = 5000;

  public acquireLock(lockKey: number, timeoutMs = this.defaultTimeoutMs): { acquired: boolean } {
    const existing = this.activeLocks.get(lockKey);
    const now = Date.now();

    if (existing) {
      if (now - existing.acquiredAt > existing.timeoutMs) {
        // Break expired deadlocked lock
        this.activeLocks.set(lockKey, { lockKey, acquiredAt: now, timeoutMs });
        return { acquired: true };
      }
      return { acquired: false };
    }

    this.activeLocks.set(lockKey, { lockKey, acquiredAt: now, timeoutMs });
    return { acquired: true };
  }

  public releaseLock(lockKey: number): void {
    this.activeLocks.delete(lockKey);
  }
}
