/**
 * Architecture Service 84: Multi-Tenant Storage Quota Enforcement Engine
 * Subsystem: Hard Cap Alerts
 */

export class StorageQuotaEnforcementEngineService {
  private tenantUsage = new Map<string, number>(); // tenantId -> bytes
  private readonly defaultHardCapBytes: number;

  constructor(defaultHardCapBytes = 100 * 1024 * 1024) { // 100 MB
    this.defaultHardCapBytes = defaultHardCapBytes;
  }

  public recordWrite(tenantId: string, bytes: number): { allowed: boolean; remainingBytes: number } {
    const current = this.tenantUsage.get(tenantId) || 0;
    if (current + bytes > this.defaultHardCapBytes) {
      return { allowed: false, remainingBytes: Math.max(0, this.defaultHardCapBytes - current) };
    }
    this.tenantUsage.set(tenantId, current + bytes);
    return { allowed: true, remainingBytes: this.defaultHardCapBytes - (current + bytes) };
  }

  public getUsage(tenantId: string): number {
    return this.tenantUsage.get(tenantId) || 0;
  }
}
