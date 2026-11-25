/**
 * Architecture Service 98: REST API Rate Limiter
 * Subsystem: Dynamic Client Tier Burst Allowance Headers
 */

export class DynamicTierRateLimiterService {
  private tierLimits: Record<string, number> = {
    FREE: 60,
    PRO: 300,
    ENTERPRISE: 1200,
  };
  private clientUsage = new Map<string, number>();

  public checkRateLimit(clientId: string, tier: 'FREE' | 'PRO' | 'ENTERPRISE'): { allowed: boolean; remaining: number; limit: number } {
    const limit = this.tierLimits[tier] || this.tierLimits.FREE;
    const current = this.clientUsage.get(clientId) || 0;

    if (current >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    this.clientUsage.set(clientId, current + 1);
    return { allowed: true, remaining: limit - (current + 1), limit };
  }
}
