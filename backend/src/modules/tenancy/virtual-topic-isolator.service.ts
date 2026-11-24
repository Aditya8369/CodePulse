import crypto from 'crypto';

export interface TenantContext {
  tenantId: string;
  secretKey: string;
}

export class VirtualTopicIsolatorService {
  private secretKey: string;

  constructor(secretKey: string = 'global-tenancy-master-secret-xyz999') {
    this.secretKey = secretKey;
  }

  public generateTenantToken(tenantId: string): string {
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(`tenant:${tenantId}`);
    return hmac.digest('hex');
  }

  public resolvePhysicalTopic(virtualTopic: string, tenantId: string, token: string): {
    authorized: boolean;
    physicalTopicName: string | null;
  } {
    const expectedToken = this.generateTenantToken(tenantId);
    if (token !== expectedToken) {
      return { authorized: false, physicalTopicName: null };
    }

    // Physical topic isolated namespace: tenant-<tenantId>.<virtualTopic>
    const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedVirtual = virtualTopic.replace(/[^a-zA-Z0-9_.-]/g, '');

    return {
      authorized: true,
      physicalTopicName: `cp.${sanitizedTenant}.${sanitizedVirtual}`
    };
  }
}
