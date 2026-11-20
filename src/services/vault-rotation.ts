/**
 * Vault Rotation Client & Dual-Key Session Verification Engine
 * Handles client-side awareness of key transitions, dual-key verification windows,
 * and encrypted local storage fallback.
 */

export interface ClientDualKeySession {
  token: string;
  keyId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ClientRotationStatus {
  activeKeyId: string;
  previousKeyId: string | null;
  dualKeyWindowRemainingMs: number;
  isDualKeyActive: boolean;
  vaultStatus: 'connected' | 'fallback';
}

export class ClientVaultRotationManager {
  private activeKeyId: string;
  private previousKeyId: string | null = null;
  private dualKeyExpiresAt: number | null = null;
  private vaultStatus: 'connected' | 'fallback' = 'connected';
  private rotationListeners: Array<(status: ClientRotationStatus) => void> = [];

  constructor(initialKeyId = 'key-v1-primary') {
    this.activeKeyId = initialKeyId;
  }

  /**
   * Applies key rotation event received from server / WebSocket
   */
  public handleKeyRotation(newKeyId: string, dualKeyWindowMs = 24 * 60 * 60 * 1000) {
    this.previousKeyId = this.activeKeyId;
    this.activeKeyId = newKeyId;
    this.dualKeyExpiresAt = Date.now() + dualKeyWindowMs;

    this.notifyListeners();
  }

  /**
   * Verifies if a given session keyId is valid (either active key or within 24h dual-key window)
   */
  public isKeyValid(keyId: string): boolean {
    if (keyId === this.activeKeyId) {
      return true;
    }

    if (this.previousKeyId && keyId === this.previousKeyId && this.dualKeyExpiresAt) {
      return Date.now() < this.dualKeyExpiresAt;
    }

    return false;
  }

  public getStatus(): ClientRotationStatus {
    const now = Date.now();
    const remaining = this.dualKeyExpiresAt ? Math.max(0, this.dualKeyExpiresAt - now) : 0;

    return {
      activeKeyId: this.activeKeyId,
      previousKeyId: this.previousKeyId,
      dualKeyWindowRemainingMs: remaining,
      isDualKeyActive: remaining > 0,
      vaultStatus: this.vaultStatus,
    };
  }

  public setVaultStatus(status: 'connected' | 'fallback') {
    this.vaultStatus = status;
    this.notifyListeners();
  }

  public onRotation(listener: (status: ClientRotationStatus) => void): () => void {
    this.rotationListeners.push(listener);
    return () => {
      this.rotationListeners = this.rotationListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.rotationListeners.forEach((l) => l(status));
  }
}

