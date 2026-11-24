/**
 * WebhookAntiReplayGuard
 * Defends against replay attacks by inspecting X-GitHub-Delivery GUIDs and timestamp drift.
 * Rejects timestamp drift > 300 seconds and caches delivery GUIDs with 24-hour TTL.
 */
export class WebhookAntiReplayGuard {
  private readonly nonceCache = new Map<string, number>();
  private readonly maxDriftSeconds: number;
  private readonly ttlMs: number;

  constructor(maxDriftSeconds = 300, ttlHours = 24) {
    this.maxDriftSeconds = maxDriftSeconds;
    this.ttlMs = ttlHours * 60 * 60 * 1000;
  }

  /**
   * Validates webhook timestamp and delivery ID.
   */
  async validateDelivery(
    deliveryId: string,
    timestampHeader?: string | number,
    now: number = Date.now()
  ): Promise<{ valid: boolean; statusCode: number; reason?: string }> {
    if (!deliveryId || deliveryId.trim().length === 0) {
      return { valid: false, statusCode: 400, reason: 'Missing X-GitHub-Delivery ID' };
    }

    // 1. Validate timestamp drift if provided
    if (timestampHeader !== undefined) {
      const ts = typeof timestampHeader === 'string' ? Date.parse(timestampHeader) : timestampHeader;
      if (isNaN(ts)) {
        return { valid: false, statusCode: 400, reason: 'Invalid webhook timestamp format' };
      }

      const driftSeconds = Math.abs(now - ts) / 1000;
      if (driftSeconds > this.maxDriftSeconds) {
        return {
          valid: false,
          statusCode: 403,
          reason: `Timestamp drift (${Math.round(driftSeconds)}s) exceeds max allowed (${this.maxDriftSeconds}s)`
        };
      }
    }

    // 2. Check nonce cache
    this.pruneExpired(now);
    if (this.nonceCache.has(deliveryId)) {
      return {
        valid: false,
        statusCode: 409,
        reason: `Duplicate webhook delivery GUID '${deliveryId}' detected within sliding window`
      };
    }

    // 3. Record nonce
    this.nonceCache.set(deliveryId, now + this.ttlMs);
    return { valid: true, statusCode: 200 };
  }

  private pruneExpired(now: number): void {
    for (const [guid, expiry] of this.nonceCache.entries()) {
      if (now > expiry) {
        this.nonceCache.delete(guid);
      }
    }
  }

  getCacheSize(): number {
    return this.nonceCache.size;
  }
}
