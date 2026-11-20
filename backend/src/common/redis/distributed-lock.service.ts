import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private localLocks = new Map<string, { value: string; expiresAt: number }>();

  async acquireLock(resourceKey: string, ttlMs = 10000): Promise<string | null> {
    const now = Date.now();
    const existing = this.localLocks.get(resourceKey);

    if (existing && existing.expiresAt > now) {
      this.logger.warn(`Resource is locked: ${resourceKey}`);
      return null;
    }

    const lockValue = randomBytes(16).toString('hex');
    this.localLocks.set(resourceKey, {
      value: lockValue,
      expiresAt: now + ttlMs,
    });

    this.logger.log(`Acquired distributed lock for resource: ${resourceKey} (TTL: ${ttlMs}ms)`);
    return lockValue;
  }

  async releaseLock(resourceKey: string, lockValue: string): Promise<boolean> {
    const existing = this.localLocks.get(resourceKey);
    if (!existing || existing.value !== lockValue) {
      this.logger.warn(`Failed to release lock for ${resourceKey}: value mismatch or expired`);
      return false;
    }

    this.localLocks.delete(resourceKey);
    this.logger.log(`Released distributed lock for resource: ${resourceKey}`);
    return true;
  }

  async runWithLock<T>(resourceKey: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const lock = await this.acquireLock(resourceKey, ttlMs);
    if (!lock) {
      throw new Error(`Could not acquire lock for resource: ${resourceKey}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resourceKey, lock);
    }
  }
}
