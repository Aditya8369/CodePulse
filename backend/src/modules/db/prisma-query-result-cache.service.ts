export interface CachedQueryEntry {
  result: any;
  tags: string[];
}

export class PrismaQueryResultCacheService {
  private cache = new Map<string, CachedQueryEntry>();

  public set(queryKey: string, result: any, tags: string[]): void {
    this.cache.set(queryKey, { result, tags });
  }

  public get(queryKey: string): any | null {
    return this.cache.get(queryKey)?.result || null;
  }

  public invalidateByTag(tag: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }
}
