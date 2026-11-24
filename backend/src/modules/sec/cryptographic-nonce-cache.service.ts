export class CryptographicNonceCacheService {
  private cache = new Map<string, number>();

  public checkAndRegisterNonce(nonce: string, ttlMs: number = 300000): boolean {
    const now = Date.now();
    this.cleanupExpired(now);

    if (this.cache.has(nonce)) {
      return false; // Nonce already used -> replay detected
    }

    this.cache.set(nonce, now + ttlMs);
    return true;
  }

  private cleanupExpired(now: number): void {
    for (const [key, expiresAt] of this.cache.entries()) {
      if (expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  public size(): number {
    return this.cache.size;
  }
}
