import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptographicReplayNonceVaultService {
  private readonly vault = new Map<string, number>();
  private readonly ttlMs = 120000; // 2 minutes TTL

  public recordNonce(nonce: string, now = Date.now()): boolean {
    // Expire stale nonces
    for (const [n, ts] of this.vault.entries()) {
      if (now - ts > this.ttlMs) this.vault.delete(n);
    }

    if (this.vault.has(nonce)) return false; // Replay detected
    this.vault.set(nonce, now);
    return true;
  }
}
