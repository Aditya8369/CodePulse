import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

export interface LeaderLeaseState {
  tournamentId: string;
  currentLeaderPodId: string | null;
  isCurrentPodLeader: boolean;
  leaseExpiresAt: number;
}

@Injectable()
export class DistributedLeaderElectionService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLeaderElectionService.name);

  public static readonly LEASE_TTL_SECONDS = 10;
  public static readonly RENEWAL_INTERVAL_MS = 3000;
  public static readonly STANDBY_CHECK_INTERVAL_MS = 1000;

  private readonly activeLeases = new Map<string, { podId: string; timer: NodeJS.Timeout }>();
  private readonly inMemoryLocks = new Map<string, { podId: string; expiresAt: number }>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  public onModuleDestroy(): void {
    this.resignAll();
  }

  /**
   * Attempts to acquire distributed Redlock lease for a tournament orchestrator.
   */
  public async acquireLeadership(tournamentId: string, podId: string): Promise<boolean> {
    const key = `tournament:leader:${tournamentId}`;
    const now = Date.now();

    try {
      const client = this.redis?.getClient();
      if (client) {
        // Atomic acquire with NX (set if not exists) and EX (expire in seconds)
        const acquired = await client.set(
          key,
          podId,
          'EX',
          DistributedLeaderElectionService.LEASE_TTL_SECONDS,
          'NX',
        );

        if (acquired === 'OK') {
          this.logger.log(`[Redlock] Pod ${podId} acquired leadership for Tournament ${tournamentId}`);
          this.startRenewalHeartbeat(tournamentId, podId);
          return true;
        }

        // Check if we already hold the lease
        const current = await client.get(key);
        if (current === podId) {
          this.startRenewalHeartbeat(tournamentId, podId);
          return true;
        }

        return false;
      }
    } catch (err: unknown) {
      this.logger.debug(`Redis acquireLeadership fallback to in-memory: ${String(err)}`);
    }

    // In-memory fallback
    const current = this.inMemoryLocks.get(key);
    if (!current || now > current.expiresAt) {
      this.inMemoryLocks.set(key, {
        podId,
        expiresAt: now + DistributedLeaderElectionService.LEASE_TTL_SECONDS * 1000,
      });
      this.startRenewalHeartbeat(tournamentId, podId);
      return true;
    }

    if (current.podId === podId) {
      current.expiresAt = now + DistributedLeaderElectionService.LEASE_TTL_SECONDS * 1000;
      this.startRenewalHeartbeat(tournamentId, podId);
      return true;
    }

    return false;
  }

  /**
   * Continuous background heartbeat renewing the Redlock lease before it expires.
   */
  private startRenewalHeartbeat(tournamentId: string, podId: string): void {
    const key = `tournament:leader:${tournamentId}`;
    if (this.activeLeases.has(tournamentId)) {
      clearInterval(this.activeLeases.get(tournamentId)!.timer);
    }

    const timer = setInterval(async () => {
      try {
        const client = this.redis?.getClient();
        if (client) {
          // Lua script to renew only if we still hold the lease
          const luaRenew = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("expire", KEYS[1], ARGV[2])
            else
              return 0
            end
          `;
          const renewed = await client.eval(
            luaRenew,
            1,
            key,
            podId,
            DistributedLeaderElectionService.LEASE_TTL_SECONDS,
          );

          if (renewed !== 1) {
            this.logger.warn(`[Redlock] Pod ${podId} lost lease for Tournament ${tournamentId}`);
            clearInterval(timer);
            this.activeLeases.delete(tournamentId);
          }
          return;
        }
      } catch (err: unknown) {
        this.logger.debug(`Redis renewal skipped: ${String(err)}`);
      }

      // Memory renewal
      const lock = this.inMemoryLocks.get(key);
      if (lock && lock.podId === podId) {
        lock.expiresAt = Date.now() + DistributedLeaderElectionService.LEASE_TTL_SECONDS * 1000;
      } else {
        clearInterval(timer);
        this.activeLeases.delete(tournamentId);
      }
    }, DistributedLeaderElectionService.RENEWAL_INTERVAL_MS);

    this.activeLeases.set(tournamentId, { podId, timer });
  }

  /**
   * Graceful leader resignation on pod shutdown / termination.
   */
  public async resignLeadership(tournamentId: string, podId: string): Promise<void> {
    const key = `tournament:leader:${tournamentId}`;
    if (this.activeLeases.has(tournamentId)) {
      clearInterval(this.activeLeases.get(tournamentId)!.timer);
      this.activeLeases.delete(tournamentId);
    }

    try {
      const client = this.redis?.getClient();
      if (client) {
        // Atomic release via Lua check-and-delete
        const luaRelease = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await client.eval(luaRelease, 1, key, podId);
        this.logger.log(`[Redlock] Pod ${podId} gracefully resigned leadership for ${tournamentId}`);
        return;
      }
    } catch {
      // Memory cleanup
    }

    const lock = this.inMemoryLocks.get(key);
    if (lock && lock.podId === podId) {
      this.inMemoryLocks.delete(key);
    }
  }

  public resignAll(): void {
    for (const [tournamentId, lease] of this.activeLeases.entries()) {
      void this.resignLeadership(tournamentId, lease.podId);
    }
    this.activeLeases.clear();
    this.inMemoryLocks.clear();
  }

  /**
   * Safely advances tournament bracket ensuring only authoritative leader executes advancement.
   */
  public async advanceBracketSafely<T>(
    tournamentId: string,
    podId: string,
    advanceFn: () => Promise<T>,
  ): Promise<{ executed: boolean; result?: T }> {
    const isLeader = await this.acquireLeadership(tournamentId, podId);
    if (!isLeader) {
      return { executed: false };
    }

    const result = await advanceFn();
    return { executed: true, result };
  }

  public isLeader(tournamentId: string, podId: string): boolean {
    const key = `tournament:leader:${tournamentId}`;
    const lease = this.activeLeases.get(tournamentId);
    if (lease && lease.podId === podId) return true;

    const mem = this.inMemoryLocks.get(key);
    return Boolean(mem && mem.podId === podId && Date.now() < mem.expiresAt);
  }
}
