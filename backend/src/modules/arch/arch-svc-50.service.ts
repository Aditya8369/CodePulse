/**
 * Architecture Service 50: Multi-Tenant Tenant-Key Isolation Enforcer
 * Subsystem: NestJS Service Layers Isolation
 */

export class MultiTenantKeyIsolationEnforcerService {
  public enforceIsolationKey(tenantId: string, entityKey: string): string {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant context missing: access forbidden');
    }
    return 't:' + tenantId + ':' + entityKey;
  }

  public extractTenantKey(scopedKey: string): { tenantId: string; entityKey: string } {
    const parts = scopedKey.split(':');
    if (parts.length < 3 || parts[0] !== 't') {
      throw new Error('Malformed tenant-scoped entity key');
    }
    return {
      tenantId: parts[1],
      entityKey: parts.slice(2).join(':'),
    };
  }
}
