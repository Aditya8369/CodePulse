import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface IpThreatProfile {
  ip: string;
  threatScore: number; // 0 - 100
  isTor: boolean;
  isDatacenter: boolean;
  recent4xxFailures: number;
  maxRequestsPerMinute: number;
  refillRatePerSec: number;
  bucketCapacity: number;
}

@Injectable()
export class IpReputationService {
  private readonly logger = new Logger(IpReputationService.name);

  // In-memory fallback threat cache (when Redis is optional/offline)
  private readonly inMemoryThreatCache = new Map<
    string,
    { score: number; failures: number; lastDecayedAt: number }
  >();

  // Known sample Tor exit nodes and datacenter ranges
  private readonly torExitNodes = new Set<string>([
    '185.220.101.5',
    '185.220.102.8',
    '198.98.56.12',
    '192.42.116.16',
    '51.15.43.205',
  ]);

  private readonly datacenterAsnPrefixes = ['104.244.', '198.51.100.', '192.0.2.', '45.33.'];

  constructor(@Optional() private readonly redis?: RedisService) {}

  public isTorExitNode(ip: string): boolean {
    return this.torExitNodes.has(ip);
  }

  public isDatacenterAsn(ip: string): boolean {
    return this.datacenterAsnPrefixes.some((prefix) => ip.startsWith(prefix));
  }

  /**
   * Records a 4xx failure (e.g. failed login or 404 scanning)
   */
  public async recordFailure(ip: string): Promise<number> {
    try {
      const client = this.redis?.getClient();
      if (client) {
        const key = `threat:ip:${ip}`;
        const newScore = await client.hincrby(key, 'score', 30);
        await client.hincrby(key, 'failures', 1);
        await client.expire(key, 600); // 10 minutes TTL
        return newScore;
      }
    } catch {
      // Memory fallback
    }

    const current = this.inMemoryThreatCache.get(ip) || { score: 0, failures: 0, lastDecayedAt: Date.now() };
    current.score = Math.min(100, current.score + 30);
    current.failures += 1;
    this.inMemoryThreatCache.set(ip, current);
    return current.score;
  }

  /**
   * Calculates real-time threat score with automated exponential decay.
   */
  public async getThreatProfile(ip: string): Promise<IpThreatProfile> {
    const isTor = this.isTorExitNode(ip);
    const isDatacenter = this.isDatacenterAsn(ip);

    let baselineThreat = 0;
    if (isTor) baselineThreat += 50;
    if (isDatacenter) baselineThreat += 25;

    let dynamicFailuresScore = 0;
    let recentFailures = 0;

    try {
      const client = this.redis?.getClient();
      if (client) {
        const key = `threat:ip:${ip}`;
        const data = await client.hgetall(key);
        if (data && data.score) {
          dynamicFailuresScore = parseInt(data.score, 10) || 0;
          recentFailures = parseInt(data.failures, 10) || 0;
        }
      }
    } catch {
      // Memory fallback
      const cached = this.inMemoryThreatCache.get(ip);
      if (cached) {
        // Decay score by 50% every 5 minutes
        const elapsedMinutes = (Date.now() - cached.lastDecayedAt) / (1000 * 60);
        if (elapsedMinutes >= 5) {
          cached.score = Math.floor(cached.score * Math.pow(0.5, Math.floor(elapsedMinutes / 5)));
          cached.lastDecayedAt = Date.now();
        }
        dynamicFailuresScore = cached.score;
        recentFailures = cached.failures;
      }
    }

    const totalThreatScore = Math.min(100, baselineThreat + dynamicFailuresScore);

    // Dynamic Token Bucket Refill Matrix:
    // Score < 20: 120 req/min (2 req/sec)
    // 20 <= Score <= 60: 30 req/min (0.5 req/sec)
    // Score > 60: 3 req/min (0.05 req/sec)
    let maxRequestsPerMinute = 120;
    let refillRatePerSec = 2.0;
    let bucketCapacity = 120;

    if (totalThreatScore > 60) {
      maxRequestsPerMinute = 3;
      refillRatePerSec = 0.05;
      bucketCapacity = 3;
    } else if (totalThreatScore >= 20) {
      maxRequestsPerMinute = 30;
      refillRatePerSec = 0.5;
      bucketCapacity = 30;
    }

    return {
      ip,
      threatScore: totalThreatScore,
      isTor,
      isDatacenter,
      recent4xxFailures: recentFailures,
      maxRequestsPerMinute,
      refillRatePerSec,
      bucketCapacity,
    };
  }
}
