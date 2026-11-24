import { Injectable, Logger } from '@nestjs/common';

export interface TenantQuota {
  maxCpuCores: number;
  maxMemoryMb: number;
}

@Injectable()
export class TenantResourceQuotaGovernorService {
  private readonly logger = new Logger(TenantResourceQuotaGovernorService.name);
  private quotas = new Map<string, TenantQuota>();

  public setQuota(tenantId: string, quota: TenantQuota): void {
    this.quotas.set(tenantId, quota);
  }

  public checkRequest(tenantId: string, cpuReq: number, memReq: number): { allowed: boolean; reason?: string } {
    const q = this.quotas.get(tenantId);
    if (!q) return { allowed: true };

    if (cpuReq > q.maxCpuCores) {
      return { allowed: false, reason: 'EXCEEDED_CPU_QUOTA' };
    }
    if (memReq > q.maxMemoryMb) {
      return { allowed: false, reason: 'EXCEEDED_MEMORY_QUOTA' };
    }

    return { allowed: true };
  }
}
