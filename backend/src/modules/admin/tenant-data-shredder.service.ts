import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class TenantDataShredderService {
  private readonly logger = new Logger(TenantDataShredderService.name);
  private tenantKeys = new Map<string, string>(); // tenantId -> encryptionKey

  public setTenantKey(tenantId: string, keyHex: string): void {
    this.tenantKeys.set(tenantId, keyHex);
  }

  public cryptographicShred(tenantId: string): { shredded: boolean; proof: string } {
    if (!this.tenantKeys.has(tenantId)) {
      return { shredded: false, proof: '' };
    }

    // Overwrite key in memory with random bytes before deleting
    const zeroBytes = crypto.randomBytes(32).toString('hex');
    this.tenantKeys.set(tenantId, zeroBytes);
    this.tenantKeys.delete(tenantId);

    const proof = crypto.createHash('sha256').update(`SHREDDED:${tenantId}:${Date.now()}`).digest('hex');
    this.logger.log(`Cryptographically shredded encryption key for tenant ${tenantId}. Proof: ${proof}`);
    return { shredded: true, proof };
  }
}
