import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

export interface RouteContext {
  userId?: string;
  isWrite?: boolean;
  forcedTarget?: 'primary' | 'replica';
}

export interface ReplicaHealthStatus {
  isHealthy: boolean;
  lastChecked: number;
  replicationLagMs: number;
  consecutiveFailures: number;
}

@Injectable()
export class ReplicaRouter implements OnModuleDestroy {
  private readonly logger = new Logger(ReplicaRouter.name);

  private primaryClient: PrismaClient;
  private replicaClient: PrismaClient | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Local in-memory fallback for sticky write window (TTL: 5s)
  private readonly inMemoryRecentWrites = new Map<string, number>();

  private replicaHealth: ReplicaHealthStatus = {
    isHealthy: true,
    lastChecked: Date.now(),
    replicationLagMs: 0,
    consecutiveFailures: 0,
  };

  public static readonly STICKY_WINDOW_MS = 5000; // 5-second sticky session for Read-Your-Own-Writes
  public static readonly HEALTH_CHECK_INTERVAL_MS = 10000;

  constructor(
    @Optional() primaryPrismaClient?: PrismaClient,
    @Optional() private readonly redis?: RedisService,
  ) {
    this.primaryClient = primaryPrismaClient || new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/codepulse',
        },
      },
    });

    const replicaUrl = process.env.DATABASE_REPLICA_URL;
    if (replicaUrl) {
      try {
        this.replicaClient = new PrismaClient({
          datasources: { db: { url: replicaUrl } },
        });
      } catch (err: unknown) {
        this.logger.warn(`Could not initialize read replica pool: ${String(err)}`);
        this.replicaHealth.isHealthy = false;
      }
    }

    this.startHealthChecks();
  }

  public onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Sets custom primary or replica clients (useful for testing or dynamic pools).
   */
  public setClients(primary: PrismaClient, replica?: PrismaClient | null): void {
    this.primaryClient = primary;
    this.replicaClient = replica ?? null;
    if (replica) {
      this.replicaHealth.isHealthy = true;
    }
  }

  /**
   * Records a recent mutation (write) by user to enforce Read-Your-Own-Writes.
   */
  public async recordWrite(userId: string, lsn?: string): Promise<void> {
    if (!userId) return;
    const now = Date.now();

    // Store in Redis with 5s TTL
    try {
      const client = this.redis?.getClient();
      if (client) {
        const key = `user:recent_write:${userId}`;
        const val = JSON.stringify({ timestamp: now, lsn: lsn || 'auto' });
        await client.set(key, val, 'EX', Math.ceil(ReplicaRouter.STICKY_WINDOW_MS / 1000));
        return;
      }
    } catch (err: unknown) {
      this.logger.debug(`Redis recordWrite skipped: ${String(err)}`);
    }

    // In-memory fallback
    this.inMemoryRecentWrites.set(userId, now + ReplicaRouter.STICKY_WINDOW_MS);
  }

  /**
   * Checks whether the user has performed a mutation within the sticky window.
   */
  public async hasRecentWrite(userId?: string): Promise<boolean> {
    if (!userId) return false;
    const now = Date.now();

    try {
      const client = this.redis?.getClient();
      if (client) {
        const val = await client.get(`user:recent_write:${userId}`);
        if (val) return true;
      }
    } catch {
      // Fall through to memory
    }

    const expiresAt = this.inMemoryRecentWrites.get(userId);
    if (expiresAt && now < expiresAt) {
      return true;
    }

    if (expiresAt && now >= expiresAt) {
      this.inMemoryRecentWrites.delete(userId);
    }

    return false;
  }

  /**
   * Selects the appropriate Prisma client based on operation type, user write recency, and replica health.
   */
  public async getClient(context?: RouteContext): Promise<PrismaClient> {
    if (context?.forcedTarget === 'primary') return this.primaryClient;
    if (context?.forcedTarget === 'replica' && this.replicaClient && this.replicaHealth.isHealthy) {
      return this.replicaClient;
    }

    // All mutations must execute on Primary DB
    if (context?.isWrite) {
      return this.primaryClient;
    }

    // Read-Your-Own-Writes guarantee:
    // If user has recent write within 5s, route to Primary to avoid replication lag
    if (context?.userId) {
      const recent = await this.hasRecentWrite(context.userId);
      if (recent) {
        return this.primaryClient;
      }
    }

    // If replica is available and healthy, route read query to Replica
    if (this.replicaClient && this.replicaHealth.isHealthy) {
      return this.replicaClient;
    }

    // Automatic failover to Primary if replica is missing or unhealthy
    return this.primaryClient;
  }

  /**
   * Healthcheck probe monitoring replica responsiveness.
   */
  public async probeReplicaHealth(): Promise<boolean> {
    if (!this.replicaClient) {
      this.replicaHealth.isHealthy = false;
      return false;
    }

    const start = Date.now();
    try {
      // Lightweight query
      await this.replicaClient.$queryRaw`SELECT 1`;
      this.replicaHealth.replicationLagMs = Date.now() - start;
      this.replicaHealth.isHealthy = true;
      this.replicaHealth.consecutiveFailures = 0;
      this.replicaHealth.lastChecked = Date.now();
      return true;
    } catch (err: unknown) {
      this.replicaHealth.consecutiveFailures += 1;
      if (this.replicaHealth.consecutiveFailures >= 2) {
        this.replicaHealth.isHealthy = false;
        this.logger.warn(`Read replica failed healthcheck. Routing reads to Primary failover.`);
      }
      return false;
    }
  }

  public getHealth(): ReplicaHealthStatus {
    return { ...this.replicaHealth };
  }

  private startHealthChecks(): void {
    if (!this.replicaClient) return;

    this.healthCheckInterval = setInterval(() => {
      void this.probeReplicaHealth();
    }, ReplicaRouter.HEALTH_CHECK_INTERVAL_MS);
  }
}
