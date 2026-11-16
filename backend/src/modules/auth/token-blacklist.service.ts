import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redisClient: Redis | null = null;
  private readonly inMemoryBlacklist = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      this.redisClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Do not spam retries if Redis is not running
      });

      this.redisClient.connect().catch(() => {
        this.logger.warn('Redis unavailable for token blacklist, using in-memory fallback.');
        this.redisClient = null;
      });

      this.redisClient.on('error', () => {
        // Suppress unhandled error events
        this.redisClient = null;
      });
    } catch {
      this.redisClient = null;
    }

    // Periodic sweep for expired in-memory blacklist entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.inMemoryBlacklist.entries()) {
        if (expiresAt <= now) {
          this.inMemoryBlacklist.delete(key);
        }
      }
    }, 60000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {
        // ignore
      }
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async blacklistToken(token: string, ttlSeconds: number = 7 * 24 * 3600): Promise<void> {
    const tokenHash = this.hashToken(token);
    const key = `blacklist:${tokenHash}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.set(key, '1', 'EX', ttlSeconds);
        return;
      } catch {
        // Fall back to in-memory
      }
    }

    this.inMemoryBlacklist.set(key, Date.now() + ttlSeconds * 1000);
  }

  async blacklistFamily(familyId: string, ttlSeconds: number = 7 * 24 * 3600): Promise<void> {
    const key = `blacklist:family:${familyId}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.set(key, '1', 'EX', ttlSeconds);
        return;
      } catch {
        // Fall back to in-memory
      }
    }

    this.inMemoryBlacklist.set(key, Date.now() + ttlSeconds * 1000);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const key = `blacklist:${tokenHash}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const exists = await this.redisClient.exists(key);
        if (exists === 1) return true;
      } catch {
        // Fall back to in-memory check
      }
    }

    const exp = this.inMemoryBlacklist.get(key);
    if (exp) {
      if (exp > Date.now()) return true;
      this.inMemoryBlacklist.delete(key);
    }
    return false;
  }

  async isFamilyBlacklisted(familyId: string): Promise<boolean> {
    const key = `blacklist:family:${familyId}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const exists = await this.redisClient.exists(key);
        if (exists === 1) return true;
      } catch {
        // Fall back to in-memory check
      }
    }

    const exp = this.inMemoryBlacklist.get(key);
    if (exp) {
      if (exp > Date.now()) return true;
      this.inMemoryBlacklist.delete(key);
    }
    return false;
  }
}
