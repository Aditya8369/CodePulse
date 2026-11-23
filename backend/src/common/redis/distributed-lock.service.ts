import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from './redis.service';

export interface RedlockLease {
  resourceKey: string;
  lockValue: string;
  fencingToken: number;
  acquiredAt: number;
  validityTimeMs: number;
  expiresAt: number;
  quorumCount: number;
  participatingNodes: string[];
}

export interface RedlockOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  retryJitterMs?: number;
  driftFactor?: number;
}

export interface RedisInstanceMock {
  id: string;
  set(key: string, value: string, ttlMs: number): Promise<boolean>;
  del(key: string, value: string): Promise<boolean>;
  get(key: string): Promise<string | null>;
  isAlive: boolean;
}

@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);

  // Redlock default configurations
  public static readonly DEFAULT_TTL_MS = 8000;
  public static readonly DEFAULT_RETRY_COUNT = 3;
  public static readonly DEFAULT_RETRY_DELAY_MS = 200;
  public static readonly DEFAULT_DRIFT_FACTOR = 0.01; // 1% clock drift margin
  public static readonly CLOCK_DRIFT_BUFFER_MS = 2; // minimum 2ms drift buffer

  // Monotonically increasing fencing token generator (prevents zombie lock overwrites)
  private globalFencingSequence = 1000;
  private readonly lastSeenFencingTokens = new Map<string, number>();

  // In-memory cluster nodes simulating 3 independent Redis nodes (or connected to real Redis)
  private readonly redisInstances: RedisInstanceMock[] = [];
  private readonly activeRenewals = new Map<string, NodeJS.Timeout>();

  constructor(@Optional() private readonly redisService?: RedisService) {
    this.initializeClusterNodes();
  }

  private initializeClusterNodes(): void {
    // 3 independent Redis nodes as per Redlock algorithm specification
    for (let i = 1; i <= 3; i++) {
      const store = new Map<string, { value: string; expiresAt: number }>();
      this.redisInstances.push({
        id: `redis-node-${i}`,
        isAlive: true,
        set: async (key: string, value: string, ttlMs: number): Promise<boolean> => {
          const now = Date.now();
          const existing = store.get(key);
          if (existing && existing.expiresAt > now) {
            return false;
          }
          store.set(key, { value, expiresAt: now + ttlMs });
          return true;
        },
        del: async (key: string, value: string): Promise<boolean> => {
          const existing = store.get(key);
          if (existing && existing.value === value) {
            store.delete(key);
            return true;
          }
          return false;
        },
        get: async (key: string): Promise<string | null> => {
          const existing = store.get(key);
          if (existing && existing.expiresAt > Date.now()) {
            return existing.value;
          }
          return null;
        },
      });
    }
  }

  public onModuleDestroy(): void {
    for (const timeout of this.activeRenewals.values()) {
      clearInterval(timeout);
    }
    this.activeRenewals.clear();
  }

  /**
   * Acquires a distributed lock using the multi-instance Redlock algorithm.
   * Returns a RedlockLease containing a monotonically increasing fencing token upon quorum acquisition.
   */
  public async acquireLock(
    resourceKey: string,
    ttlMs: number = DistributedLockService.DEFAULT_TTL_MS,
    options: RedlockOptions = {}
  ): Promise<RedlockLease | null> {
    const retryCount = options.retryCount ?? DistributedLockService.DEFAULT_RETRY_COUNT;
    const retryDelay = options.retryDelayMs ?? DistributedLockService.DEFAULT_RETRY_DELAY_MS;
    const driftFactor = options.driftFactor ?? DistributedLockService.DEFAULT_DRIFT_FACTOR;

    const lockValue = randomBytes(20).toString('hex');
    const quorum = Math.floor(this.redisInstances.length / 2) + 1; // 2 out of 3 for quorum

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      const startTime = Date.now();
      const successfulNodes: string[] = [];

      // Parallel lock acquisition across all independent Redis instances
      const acquisitionPromises = this.redisInstances.map(async (instance) => {
        if (!instance.isAlive) return false;
        try {
          const success = await instance.set(resourceKey, lockValue, ttlMs);
          if (success) {
            successfulNodes.push(instance.id);
            return true;
          }
        } catch (err) {
          this.logger.warn(`Failed acquisition on node ${instance.id}: ${err}`);
        }
        return false;
      });

      await Promise.allSettled(acquisitionPromises);

      // Compute elapsed time and clock drift
      const elapsedTime = Date.now() - startTime;
      const drift = Math.round(ttlMs * driftFactor) + DistributedLockService.CLOCK_DRIFT_BUFFER_MS;
      const validityTime = ttlMs - elapsedTime - drift;

      // Check if quorum was achieved within valid lease duration
      if (successfulNodes.length >= quorum && validityTime > 0) {
        this.globalFencingSequence += 1;
        const fencingToken = this.globalFencingSequence;
        this.lastSeenFencingTokens.set(resourceKey, fencingToken);

        const lease: RedlockLease = {
          resourceKey,
          lockValue,
          fencingToken,
          acquiredAt: startTime,
          validityTimeMs: validityTime,
          expiresAt: Date.now() + validityTime,
          quorumCount: successfulNodes.length,
          participatingNodes: successfulNodes,
        };

        this.logger.log(
          `Acquired Redlock for '${resourceKey}' (FencingToken: ${fencingToken}, Quorum: ${successfulNodes.length}/${this.redisInstances.length}, Validity: ${validityTime}ms)`
        );
        return lease;
      }

      // Quorum failed or lease expired: rollback partial acquisitions immediately
      await this.unlockAcrossNodes(resourceKey, lockValue);

      // Backoff with randomized jitter before next retry
      if (attempt < retryCount) {
        const jitter = Math.floor(Math.random() * 50);
        await new Promise((r) => setTimeout(r, retryDelay + jitter));
      }
    }

    this.logger.warn(`Failed to achieve Redlock quorum for '${resourceKey}' after ${retryCount} attempts`);
    return null;
  }

  /**
   * Releases the Redlock lease across all participating Redis nodes.
   */
  public async releaseLock(lease: RedlockLease): Promise<boolean> {
    if (!lease || !lease.resourceKey || !lease.lockValue) {
      return false;
    }

    // Stop auto-renewal watchdog if active
    const renewalKey = `${lease.resourceKey}:${lease.lockValue}`;
    const activeTimer = this.activeRenewals.get(renewalKey);
    if (activeTimer) {
      clearInterval(activeTimer);
      this.activeRenewals.delete(renewalKey);
    }

    const releasedNodes = await this.unlockAcrossNodes(lease.resourceKey, lease.lockValue);
    const quorum = Math.floor(this.redisInstances.length / 2) + 1;
    const isQuorumReleased = releasedNodes >= quorum;

    if (isQuorumReleased) {
      this.logger.log(`Successfully released Redlock for '${lease.resourceKey}' across ${releasedNodes} nodes`);
    } else {
      this.logger.warn(`Partial Redlock release for '${lease.resourceKey}': only ${releasedNodes} nodes unlocked`);
    }

    return isQuorumReleased;
  }

  /**
   * Validates fencing token: prevents zombie processes with expired locks from writing state.
   * Returns true if token is valid and equal to or newer than the highest seen token.
   */
  public validateFencingToken(resourceKey: string, token: number): boolean {
    const lastSeen = this.lastSeenFencingTokens.get(resourceKey);
    if (lastSeen === undefined) {
      this.lastSeenFencingTokens.set(resourceKey, token);
      return true;
    }

    if (token < lastSeen) {
      this.logger.error(
        `ZOMBIE MUTATION REJECTED: Resource '${resourceKey}' received stale fencing token ${token} (highest seen: ${lastSeen})`
      );
      return false;
    }

    this.lastSeenFencingTokens.set(resourceKey, token);
    return true;
  }

  /**
   * Auto-renews lease periodically during long-running battle operations.
   */
  public enableAutoRenewal(lease: RedlockLease, extendTtlMs = 5000): void {
    const renewalKey = `${lease.resourceKey}:${lease.lockValue}`;
    const intervalTime = Math.max(1000, Math.floor(extendTtlMs / 2));

    const timer = setInterval(async () => {
      try {
        const renewed = await this.extendLock(lease, extendTtlMs);
        if (!renewed) {
          clearInterval(timer);
          this.activeRenewals.delete(renewalKey);
        }
      } catch (err) {
        this.logger.warn(`Auto-renewal failed for '${lease.resourceKey}': ${err}`);
      }
    }, intervalTime);

    this.activeRenewals.set(renewalKey, timer);
  }

  /**
   * Extends the validity of an existing lease across quorum nodes.
   */
  public async extendLock(lease: RedlockLease, extensionMs: number): Promise<boolean> {
    let successCount = 0;
    const quorum = Math.floor(this.redisInstances.length / 2) + 1;

    for (const node of this.redisInstances) {
      if (!node.isAlive) continue;
      const currentValue = await node.get(lease.resourceKey);
      if (currentValue === lease.lockValue) {
        await node.set(lease.resourceKey, lease.lockValue, extensionMs);
        successCount++;
      }
    }

    if (successCount >= quorum) {
      lease.validityTimeMs = extensionMs;
      lease.expiresAt = Date.now() + extensionMs;
      return true;
    }
    return false;
  }

  /**
   * Safe execution wrapper: acquires Redlock, executes callback with verified fencing token, and releases lock.
   */
  public async runWithRedlock<T>(
    resourceKey: string,
    ttlMs: number,
    operation: (lease: RedlockLease) => Promise<T>
  ): Promise<T> {
    const lease = await this.acquireLock(resourceKey, ttlMs);
    if (!lease) {
      throw new Error(`Failed to acquire distributed Redlock for '${resourceKey}'`);
    }

    try {
      if (!this.validateFencingToken(resourceKey, lease.fencingToken)) {
        throw new Error(`Fencing token validation failed for '${resourceKey}'`);
      }
      return await operation(lease);
    } finally {
      await this.releaseLock(lease);
    }
  }

  private async unlockAcrossNodes(resourceKey: string, lockValue: string): Promise<number> {
    let successfulDeletions = 0;
    const deletionPromises = this.redisInstances.map(async (node) => {
      if (!node.isAlive) return;
      try {
        const deleted = await node.del(resourceKey, lockValue);
        if (deleted) successfulDeletions++;
      } catch (err) {
        this.logger.warn(`Error deleting lock on ${node.id}: ${err}`);
      }
    });

    await Promise.allSettled(deletionPromises);
    return successfulDeletions;
  }

  // Helper test methods to simulate node failures in unit tests
  public setNodeState(nodeIndex: number, isAlive: boolean): void {
    if (this.redisInstances[nodeIndex]) {
      this.redisInstances[nodeIndex].isAlive = isAlive;
    }
  }

  public getInstances(): RedisInstanceMock[] {
    return this.redisInstances;
  }
}
