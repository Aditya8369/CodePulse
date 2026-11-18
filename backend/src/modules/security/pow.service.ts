import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import Redis from 'ioredis';

export interface PowChallengeResponse {
  challenge: string;
  challengeId: string;
  algorithm: 'SHA-256';
  difficulty: number;
  targetPrefix: string;
  issuedAt: number;
  expiresAt: number;
  ttlSeconds: number;
  surgeActive: boolean;
}

export interface PowVerificationResult {
  valid: boolean;
  challengeId?: string;
  difficulty?: number;
  hash?: string;
  reason?: string;
  verificationTimeMs: number;
}

export interface PowTrafficMetrics {
  requestsLastMinute: number;
  surgeThresholdPerMin: number;
  surgeActive: boolean;
  activeDifficulty: number;
  normalDifficulty: number;
  surgeDifficulty: number;
  replayTtlSeconds: number;
  redisConnected: boolean;
}

export interface PowServiceOptions {
  hmacSecret?: string;
  normalDifficulty?: number;
  surgeDifficulty?: number;
  surgeThresholdPerMin?: number;
  challengeTtlSeconds?: number;
  disableRedis?: boolean;
}

export interface PowRedisLike {
  status?: string;
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    time: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  exists(key: string): Promise<number>;
  disconnect(): void;
}

@Injectable()
export class PowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PowService.name);

  private hmacSecret: string;
  private normalDifficulty: number;
  private surgeDifficulty: number;
  private surgeThresholdPerMin: number;
  private challengeTtlSeconds: number;
  private disableRedis: boolean;

  private redisClient: PowRedisLike | null = null;
  private readonly inMemoryUsedChallenges = new Map<string, number>();
  private trafficTimestamps: number[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() options?: PowServiceOptions,
  ) {
    this.hmacSecret =
      options?.hmacSecret ||
      this.configService?.get<string>('POW_HMAC_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.POW_HMAC_SECRET ||
      process.env.JWT_SECRET ||
      'codepulse-pow-hmac-secret-key-32bytes';

    this.normalDifficulty =
      options?.normalDifficulty ??
      parseInt(
        this.configService?.get<string>('POW_NORMAL_DIFFICULTY') ||
          process.env.POW_NORMAL_DIFFICULTY ||
          '4',
        10,
      );

    this.surgeDifficulty =
      options?.surgeDifficulty ??
      parseInt(
        this.configService?.get<string>('POW_SURGE_DIFFICULTY') ||
          process.env.POW_SURGE_DIFFICULTY ||
          '6',
        10,
      );

    this.surgeThresholdPerMin =
      options?.surgeThresholdPerMin ??
      parseInt(
        this.configService?.get<string>('POW_SURGE_THRESHOLD_PER_MIN') ||
          process.env.POW_SURGE_THRESHOLD_PER_MIN ||
          '60',
        10,
      );

    this.challengeTtlSeconds =
      options?.challengeTtlSeconds ??
      parseInt(
        this.configService?.get<string>('POW_TTL_SECONDS') ||
          process.env.POW_TTL_SECONDS ||
          '180',
        10,
      );

    this.disableRedis =
      options?.disableRedis ?? process.env.NODE_ENV === 'test';

    this.cleanupInterval = setInterval(() => {
      this.purgeExpiredEntries();
    }, 30_000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleInit(): void {
    if (this.disableRedis) {
      return;
    }

    const host =
      this.configService?.get<string>('REDIS_HOST') ||
      process.env.REDIS_HOST ||
      'localhost';
    const port = parseInt(
      this.configService?.get<string>('REDIS_PORT') ||
        process.env.REDIS_PORT ||
        '6379',
      10,
    );
    const password =
      this.configService?.get<string>('REDIS_PASSWORD') ||
      process.env.REDIS_PASSWORD ||
      undefined;

    try {
      const client = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });

      client.on('error', () => {
        this.redisClient = null;
      });

      client
        .connect()
        .then(() => {
          this.redisClient = client as unknown as PowRedisLike;
        })
        .catch(() => {
          this.logger.warn(
            'Redis unavailable for PoW replay protection; using in-memory TTL store fallback.',
          );
          this.redisClient = null;
        });
    } catch {
      this.redisClient = null;
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {
        // Ignore disconnect errors on shutdown
      }
      this.redisClient = null;
    }
  }

  /**
   * Injects a custom or mock Redis client (useful for deterministic unit tests).
   */
  setRedisClient(client: PowRedisLike | null): void {
    this.redisClient = client;
  }

  /**
   * Updates difficulty and surge thresholds at runtime.
   */
  configure(options: Partial<PowServiceOptions>): void {
    if (options.hmacSecret !== undefined) this.hmacSecret = options.hmacSecret;
    if (options.normalDifficulty !== undefined) {
      this.normalDifficulty = options.normalDifficulty;
    }
    if (options.surgeDifficulty !== undefined) {
      this.surgeDifficulty = options.surgeDifficulty;
    }
    if (options.surgeThresholdPerMin !== undefined) {
      this.surgeThresholdPerMin = options.surgeThresholdPerMin;
    }
    if (options.challengeTtlSeconds !== undefined) {
      this.challengeTtlSeconds = options.challengeTtlSeconds;
    }
  }

  /**
   * Records incoming traffic hits in a rolling 60-second window.
   */
  recordTraffic(count = 1, now = Date.now()): void {
    for (let i = 0; i < count; i++) {
      this.trafficTimestamps.push(now);
    }
    this.pruneTrafficWindow(now);
  }

  /**
   * Resets the rolling traffic window (useful for tests).
   */
  resetTrafficWindow(): void {
    this.trafficTimestamps = [];
  }

  /**
   * Returns true when rolling 60-second request volume hits or exceeds the surge threshold.
   */
  isTrafficSurge(now = Date.now()): boolean {
    this.pruneTrafficWindow(now);
    return this.trafficTimestamps.length >= this.surgeThresholdPerMin;
  }

  /**
   * Returns calibrated leading hex zero difficulty:
   * - Normal traffic: 4 leading zeros (~50ms in WebAssembly)
   * - Traffic surge:  6 leading zeros (~400ms in WebAssembly)
   */
  getCurrentDifficulty(now = Date.now()): number {
    return this.isTrafficSurge(now)
      ? this.surgeDifficulty
      : this.normalDifficulty;
  }

  /**
   * Generates a signed cryptographic Proof-of-Work challenge.
   * Client must find `nonce` such that SHA256(challenge + nonce) starts with `difficulty` hex zeros.
   */
  generateChallenge(now = Date.now()): PowChallengeResponse {
    const difficulty = this.getCurrentDifficulty(now);
    const challengeId = randomBytes(16).toString('hex');
    const issuedAt = now;
    const expiresAt = issuedAt + this.challengeTtlSeconds * 1000;

    const unsignedPayload = `${challengeId}.${issuedAt}.${expiresAt}.${difficulty}`;
    const signature = this.signPayload(unsignedPayload);
    const challenge = `${unsignedPayload}.${signature}`;

    return {
      challenge,
      challengeId,
      algorithm: 'SHA-256',
      difficulty,
      targetPrefix: '0'.repeat(difficulty),
      issuedAt,
      expiresAt,
      ttlSeconds: this.challengeTtlSeconds,
      surgeActive: difficulty >= this.surgeDifficulty,
    };
  }

  /**
   * Verifies a client-submitted nonce in < 1ms and prevents replay attacks
   * by storing redeemed challenge IDs in Redis with a 3-minute (180s) TTL.
   */
  async verifySolution(
    challenge: string,
    nonce: string,
    now = Date.now(),
  ): Promise<PowVerificationResult> {
    const startNs = process.hrtime.bigint();
    const elapsedMs = () =>
      Number(process.hrtime.bigint() - startNs) / 1_000_000;

    if (
      typeof challenge !== 'string' ||
      typeof nonce !== 'string' ||
      challenge.length === 0 ||
      challenge.length > 256 ||
      nonce.length === 0 ||
      nonce.length > 64
    ) {
      return {
        valid: false,
        reason: 'Malformed challenge or nonce payload',
        verificationTimeMs: elapsedMs(),
      };
    }

    const parts = challenge.split('.');
    if (parts.length !== 5) {
      return {
        valid: false,
        reason: 'Invalid challenge structure',
        verificationTimeMs: elapsedMs(),
      };
    }

    const [challengeId, issuedAtStr, expiresAtStr, difficultyStr, signature] =
      parts;
    const issuedAt = Number(issuedAtStr);
    const expiresAt = Number(expiresAtStr);
    const difficulty = Number(difficultyStr);

    if (
      !/^[a-f0-9]{32}$/i.test(challengeId) ||
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      !Number.isInteger(difficulty) ||
      difficulty < 1 ||
      difficulty > 12
    ) {
      return {
        valid: false,
        reason: 'Invalid challenge metadata parameters',
        verificationTimeMs: elapsedMs(),
      };
    }

    if (now > expiresAt) {
      return {
        valid: false,
        challengeId,
        difficulty,
        reason: 'Proof-of-Work challenge has expired',
        verificationTimeMs: elapsedMs(),
      };
    }

    // Verify HMAC signature in constant time to prevent difficulty tampering
    const unsignedPayload = `${challengeId}.${issuedAtStr}.${expiresAtStr}.${difficultyStr}`;
    const expectedSig = this.signPayload(unsignedPayload);
    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');

    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return {
        valid: false,
        challengeId,
        difficulty,
        reason: 'Invalid challenge HMAC signature',
        verificationTimeMs: elapsedMs(),
      };
    }

    // Verify SHA256(challenge + nonce) has `difficulty` leading hex zeros
    const digest = createHash('sha256')
      .update(`${challenge}${nonce}`)
      .digest('hex');

    const targetPrefix = '0'.repeat(difficulty);
    if (!digest.startsWith(targetPrefix)) {
      return {
        valid: false,
        challengeId,
        difficulty,
        hash: digest,
        reason: `Hash does not satisfy difficulty target (${difficulty} leading zeros)`,
        verificationTimeMs: elapsedMs(),
      };
    }

    // Prevent replay attacks within the 3-minute (180s) expiration window
    const redeemed = await this.markChallengeRedeemed(
      challengeId,
      nonce,
      now,
    );
    if (!redeemed) {
      return {
        valid: false,
        challengeId,
        difficulty,
        hash: digest,
        reason: 'Challenge nonce already redeemed (replay attack blocked)',
        verificationTimeMs: elapsedMs(),
      };
    }

    return {
      valid: true,
      challengeId,
      difficulty,
      hash: digest,
      verificationTimeMs: elapsedMs(),
    };
  }

  getTrafficMetrics(now = Date.now()): PowTrafficMetrics {
    this.pruneTrafficWindow(now);
    const activeDifficulty = this.getCurrentDifficulty(now);
    return {
      requestsLastMinute: this.trafficTimestamps.length,
      surgeThresholdPerMin: this.surgeThresholdPerMin,
      surgeActive: activeDifficulty >= this.surgeDifficulty,
      activeDifficulty,
      normalDifficulty: this.normalDifficulty,
      surgeDifficulty: this.surgeDifficulty,
      replayTtlSeconds: this.challengeTtlSeconds,
      redisConnected:
        this.redisClient !== null &&
        (this.redisClient.status === undefined ||
          this.redisClient.status === 'ready'),
    };
  }

  private signPayload(payload: string): string {
    return createHmac('sha256', this.hmacSecret)
      .update(payload)
      .digest('hex')
      .slice(0, 32);
  }

  private async markChallengeRedeemed(
    challengeId: string,
    nonce: string,
    now: number,
  ): Promise<boolean> {
    const redisKey = `pow:replay:${challengeId}`;

    if (
      this.redisClient &&
      (this.redisClient.status === undefined ||
        this.redisClient.status === 'ready')
    ) {
      try {
        const result = await this.redisClient.set(
          redisKey,
          nonce,
          'EX',
          this.challengeTtlSeconds,
          'NX',
        );
        return result === 'OK';
      } catch {
        // Fall through to in-memory replay map if Redis errors transiently
      }
    }

    const existingExpiry = this.inMemoryUsedChallenges.get(redisKey);
    if (existingExpiry !== undefined && existingExpiry > now) {
      return false;
    }

    this.inMemoryUsedChallenges.set(
      redisKey,
      now + this.challengeTtlSeconds * 1000,
    );
    return true;
  }

  private pruneTrafficWindow(now: number): void {
    const cutoff = now - 60_000;
    while (
      this.trafficTimestamps.length > 0 &&
      this.trafficTimestamps[0] < cutoff
    ) {
      this.trafficTimestamps.shift();
    }
  }

  private purgeExpiredEntries(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.inMemoryUsedChallenges.entries()) {
      if (expiresAt <= now) {
        this.inMemoryUsedChallenges.delete(key);
      }
    }
    this.pruneTrafficWindow(now);
  }
}
