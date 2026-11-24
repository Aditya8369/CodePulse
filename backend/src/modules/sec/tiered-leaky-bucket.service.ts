export type UserTier = 'GUEST' | 'REGISTERED' | 'ENTERPRISE';

export class TieredLeakyBucketService {
  private capacities: Record<UserTier, number> = {
    GUEST: 10,
    REGISTERED: 50,
    ENTERPRISE: 500
  };

  private buckets = new Map<string, number>();

  public consume(clientId: string, tier: UserTier): boolean {
    const cap = this.capacities[tier];
    const cur = this.buckets.get(clientId) || 0;

    if (cur < cap) {
      this.buckets.set(clientId, cur + 1);
      return true;
    }
    return false;
  }
}
