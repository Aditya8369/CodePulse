import { Injectable } from '@nestjs/common';

@Injectable()
export class ColdStorageRetrievalProxyService {
  private readonly index = new Map<string, { tier: 'HOT' | 'COLD' | 'GLACIER'; s3Key: string }>();

  public indexRecord(id: string, tier: 'HOT' | 'COLD' | 'GLACIER', s3Key: string): void {
    this.index.set(id, { tier, s3Key });
  }

  public resolveFetchPath(id: string): { tier: string; requiresRestoration: boolean; s3Key?: string } {
    const entry = this.index.get(id);
    if (!entry) return { tier: 'UNKNOWN', requiresRestoration: false };
    return {
      tier: entry.tier,
      requiresRestoration: entry.tier === 'GLACIER',
      s3Key: entry.s3Key,
    };
  }
}
