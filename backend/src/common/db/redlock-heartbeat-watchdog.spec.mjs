import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedlockHeartbeatWatchdog {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.activeTimers = new Map();
    this.totalWatchdogsStarted = 0;
    this.totalHeartbeatsSent = 0;
    this.totalLeasesExtended = 0;
    this.lostLocksDetected = 0;
  }

  startWatchdog(lockKey, ownerUuid, ttlMs, onLockLost) {
    const heartbeatInterval = Math.max(20, Math.floor(ttlMs / 3));
    this.totalWatchdogsStarted++;

    const timer = setInterval(async () => {
      this.totalHeartbeatsSent++;
      try {
        const extended = await this.redisClient.eval(
          'EXTEND_LOCK_LUA',
          1,
          lockKey,
          ownerUuid,
          ttlMs
        );
        if (extended === 1 || extended === true) {
          this.totalLeasesExtended++;
        } else {
          this.lostLocksDetected++;
          this.stopWatchdog(lockKey);
          if (onLockLost) onLockLost();
        }
      } catch (err) {}
    }, heartbeatInterval);

    if (timer.unref) timer.unref();
    this.activeTimers.set(lockKey, timer);

    return {
      stop: () => this.stopWatchdog(lockKey)
    };
  }

  stopWatchdog(lockKey) {
    const timer = this.activeTimers.get(lockKey);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(lockKey);
    }
  }

  async executeWithWatchdog(lockKey, ownerUuid, ttlMs, taskFn) {
    const abortController = new AbortController();
    const watchdog = this.startWatchdog(lockKey, ownerUuid, ttlMs, () => {
      abortController.abort(new Error(`Distributed lock ${lockKey} was lost`));
    });

    try {
      return await taskFn(abortController.signal);
    } finally {
      watchdog.stop();
      try {
        await this.redisClient.eval('RELEASE_LOCK_LUA', 1, lockKey, ownerUuid, 0);
      } catch (e) {}
    }
  }

  getMetrics() {
    return {
      totalWatchdogsStarted: this.totalWatchdogsStarted,
      totalHeartbeatsSent: this.totalHeartbeatsSent,
      totalLeasesExtended: this.totalLeasesExtended,
      lostLocksDetected: this.lostLocksDetected
    };
  }
}

describe('RedlockHeartbeatWatchdog (Issue #1667)', () => {
  it('should auto-renew lock lease periodically until work completes', async () => {
    let leaseExtensions = 0;
    let released = false;

    const mockRedis = {
      eval: async (script, numKeys, key, owner, ttl) => {
        if (script === 'EXTEND_LOCK_LUA') {
          leaseExtensions++;
          return 1;
        }
        if (script === 'RELEASE_LOCK_LUA') {
          released = true;
          return 1;
        }
        return 0;
      }
    };

    const watchdog = new RedlockHeartbeatWatchdog(mockRedis);

    // TTL = 90ms, heartbeat interval = 30ms. Task runs for 100ms
    const result = await watchdog.executeWithWatchdog('lock:tournament:42', 'worker-uuid-1', 90, async (signal) => {
      await new Promise(r => setTimeout(r, 100));
      assert.equal(signal.aborted, false);
      return { bracketCreated: true };
    });

    assert.equal(result.bracketCreated, true);
    assert.ok(leaseExtensions >= 2, `Expected at least 2 lease extensions, got ${leaseExtensions}`);
    assert.equal(released, true, 'Lock must be released upon task completion');

    const metrics = watchdog.getMetrics();
    assert.equal(metrics.totalWatchdogsStarted, 1);
    assert.ok(metrics.totalLeasesExtended >= 2);
  });

  it('should abort task if lock lease extension fails because owner changed', async () => {
    let aborted = false;
    const mockRedis = {
      eval: async (script) => {
        if (script === 'EXTEND_LOCK_LUA') {
          // Simulate lock stolen by another process
          return 0;
        }
        return 0;
      }
    };

    const watchdog = new RedlockHeartbeatWatchdog(mockRedis);

    await watchdog.executeWithWatchdog('lock:stolen', 'worker-uuid-2', 60, async (signal) => {
      // Wait for heartbeat tick
      await new Promise(r => setTimeout(r, 50));
      aborted = signal.aborted;
    });

    assert.equal(aborted, true, 'Abort signal should be triggered when lock is lost');
    assert.equal(watchdog.getMetrics().lostLocksDetected, 1);
  });
});
