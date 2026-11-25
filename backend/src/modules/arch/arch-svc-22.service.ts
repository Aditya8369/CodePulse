/**
 * Architecture Service 22: Multi-Tenant Schema Isolation Proxy
 * Subsystem: Connection Pool Multiplexing
 */

export interface TenantConnectionContext {
  tenantId: string;
  schemaName: string;
  activeQueries: number;
}

export class MultiTenantSchemaIsolationProxyService {
  private schemaRegistry = new Map<string, string>();
  private activePools = new Map<string, number>(); // tenantId -> activeConnections

  private readonly maxConnectionsPerTenant: number;
  constructor(maxConnectionsPerTenant = 20) {
    this.maxConnectionsPerTenant = maxConnectionsPerTenant;
  }

  public registerTenant(tenantId: string, schemaName: string): void {
    // Sanitization: schema names must be valid SQL identifiers
    if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
      throw new Error('Invalid schema name identifier');
    }
    this.schemaRegistry.set(tenantId, schemaName);
    this.activePools.set(tenantId, 0);
  }

  public getScopedQuery(tenantId: string, rawQuery: string): { scopedSql: string; schema: string } {
    const schema = this.schemaRegistry.get(tenantId);
    if (!schema) {
      throw new Error('Unregistered tenant ' + tenantId);
    }
    // Prefix table references with validated tenant schema
    const scopedSql = 'SET search_path TO ' + schema + '; ' + rawQuery;
    return { scopedSql, schema };
  }

  public acquireConnection(tenantId: string): boolean {
    const count = this.activePools.get(tenantId) || 0;
    if (count >= this.maxConnectionsPerTenant) {
      return false;
    }
    this.activePools.set(tenantId, count + 1);
    return true;
  }

  public releaseConnection(tenantId: string): void {
    const count = this.activePools.get(tenantId) || 0;
    if (count > 0) {
      this.activePools.set(tenantId, count - 1);
    }
  }
}
