import { Injectable } from '@nestjs/common';

@Injectable()
export class RlsTenantLeakSentinelService {
  public validateQueryTenantIsolation(sql: string, expectedTenantId: string): { isolated: boolean; reason?: string } {
    if (!expectedTenantId || expectedTenantId.trim() === '') {
      return { isolated: false, reason: 'Missing tenant context in execution scope' };
    }

    const lower = sql.toLowerCase();
    // Verify that multi-tenant tables enforce tenant_id predicate or RLS session variable
    if (lower.includes('select') && !lower.includes('tenant_id') && !lower.includes('current_setting')) {
      return { isolated: false, reason: 'Query lacks tenant_id where clause or RLS session predicate' };
    }

    return { isolated: true };
  }
}
