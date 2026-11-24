import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantAstPredicateValidatorService {
  public validateTenantPredicateInSql(rawSql: string): boolean {
    const normalized = rawSql.toLowerCase();
    // Allow metadata schema queries
    if (normalized.includes('information_schema') || normalized.includes('pg_catalog')) return true;

    // Reject table queries that omit tenant scoping
    if (normalized.includes('from users') || normalized.includes('from guilds')) {
      return normalized.includes('tenant_id') || normalized.includes('organization_id');
    }

    return true;
  }
}
