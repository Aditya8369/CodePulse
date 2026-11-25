import { Injectable, Logger } from '@nestjs/common';

export interface RolePermit {
  permitId: string;
  granteeId: string;
  role: string;
  expiresAt: number;
}

@Injectable()
export class EphemeralAdminDelegationService {
  private readonly logger = new Logger(EphemeralAdminDelegationService.name);
  private permits = new Map<string, RolePermit>();

  public grantEphemeralPermit(permitId: string, granteeId: string, role: string, ttlMs: number): RolePermit {
    const permit: RolePermit = {
      permitId,
      granteeId,
      role,
      expiresAt: Date.now() + ttlMs
    };
    this.permits.set(permitId, permit);
    this.logger.log(`Granted ephemeral permit ${permitId} for role ${role} to ${granteeId} (TTL: ${ttlMs}ms)`);
    return permit;
  }

  public validatePermit(permitId: string, now: number = Date.now()): boolean {
    const permit = this.permits.get(permitId);
    if (!permit) return false;
    return permit.expiresAt > now;
  }
}
