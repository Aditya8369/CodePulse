/**
 * Architecture Service 41: Resilient Service Fallback Proxy
 * Subsystem: Cached Stale Responses During Outages
 */

export class ResilientFallbackProxyService {
  private cache = new Map<string, { value: unknown; timestamp: number }>();

  public async fetchWithFallback<T>(
    key: string,
    primaryFetcher: () => Promise<T>,
    fallbackValue?: T
  ): Promise<{ value: T; stale: boolean }> {
    try {
      const val = await primaryFetcher();
      this.cache.set(key, { value: val, timestamp: Date.now() });
      return { value: val, stale: false };
    } catch (err) {
      const cached = this.cache.get(key);
      if (cached) {
        return { value: cached.value as T, stale: true };
      }
      if (fallbackValue !== undefined) {
        return { value: fallbackValue, stale: true };
      }
      throw err;
    }
  }
}
