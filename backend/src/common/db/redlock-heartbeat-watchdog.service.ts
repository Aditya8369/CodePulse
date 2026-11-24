/**
 * [DB-CONCURRENCY-11]: Distributed Redlock Lease Auto-Renewal Watchdog for Long-Running Tournaments
 * 
 * Runs a background timer to extend Redis key TTL while long-running tasks execute.
 * Heartbeat interval = Math.floor(ttlMs / 3).
 * Uses Lua script for atomic lease verification and extension.
 * Automatically cancels renewal if worker thread finishes, throws, or aborts.
 */

export interface RedisLockClient {
  eval: (script: string, numKeys: number, key: string, ownerUuid: string, ttlMs: number) => Promise<number | boolean>;
  del: (key: string) => Promise<number>;
}

export interface WatchdogMetrics {
  totalWatchdogsStarted: number;
  totalHeartbeatsSent: number;
  totalLeasesExtended: number;
  lostLocksDetected: number;
}

// Atomic Lua script to verify lock ownership before extending TTL
export const EXTEND_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

export const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedlockHeartbeatWatchdog {
  private readonly redisClient: RedisLockClient;
  private activeTimers = new Map<string, NodeJS.Timeout>();

  private totalWatchdogsStarted = 0;
  private totalHeartbeatsSent = 0;
  private totalLeasesExtended = 0;
  private lostLocksDetected = 0;

  constructor(redisClient: RedisLockClient) {
    this.redisClient = redisClient;
  }

  public startWatchdog(
    lockKey: string,
    ownerUuid: string,
    ttlMs: number,
    onLockLost?: () => void
  ): { stop: () => void } {
    const heartbeatInterval = Math.max(50, Math.floor(ttlMs / 3));
    this.totalWatchdogsStarted++;

    const timer = setInterval(async () => {
      this.totalHeartbeatsSent++;
      try {
        const extended = await this.redisClient.eval(
          EXTEND_LOCK_LUA,
          1,
          lockKey,
          ownerUuid,
          ttlMs
        );

        if (extended === 1 || extended === true) {
          this.totalLeasesExtended++;
        } else {
          // Lock was lost or taken by another process
          this.lostLocksDetected++;
          this.stopWatchdog(lockKey);
          if (onLockLost) onLockLost();
        }
      } catch (err) {
        // Network or Redis glitch; keep retrying on next tick
      }
    }, heartbeatInterval);

    if (timer.unref) {
      timer.unref();
    }

    this.activeTimers.set(lockKey, timer);

    return {
      stop: () => this.stopWatchdog(lockKey)
    };
  }

  public stopWatchdog(lockKey: string): void {
    const timer = this.activeTimers.get(lockKey);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(lockKey);
    }
  }

  public async executeWithWatchdog<T>(
    lockKey: string,
    ownerUuid: string,
    ttlMs: number,
    taskFn: (abortSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const abortController = new AbortController();
    const watchdog = this.startWatchdog(lockKey, ownerUuid, ttlMs, () => {
      abortController.abort(new Error(`Distributed lock ${lockKey} was lost during execution`));
    });

    try {
      return await taskFn(abortController.signal);
    } finally {
      watchdog.stop();
      // Safely release lock using Lua atomic match
      try {
        await this.redisClient.eval(RELEASE_LOCK_LUA, 1, lockKey, ownerUuid, 0);
      } catch (e) {
        // Safe to ignore release error on cleanup
      }
    }
  }

  public getMetrics(): WatchdogMetrics {
    return {
      totalWatchdogsStarted: this.totalWatchdogsStarted,
      totalHeartbeatsSent: this.totalHeartbeatsSent,
      totalLeasesExtended: this.totalLeasesExtended,
      lostLocksDetected: this.lostLocksDetected
    };
  }
}
