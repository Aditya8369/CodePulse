import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TenantQueryAstValidatorService {
  private readonly logger = new Logger(TenantQueryAstValidatorService.name);

  public validateQuery(querySql: string): { isCompliant: boolean; error?: string } {
    const normalized = querySql.toLowerCase();
    const hasTenantPredicate = normalized.includes('tenant_id') || normalized.includes('tenantid');

    if (!hasTenantPredicate) {
      this.logger.error(`Cross-tenant query rejected: missing tenant predicate. Query: ${querySql.substring(0, 100)}`);
      return { isCompliant: false, error: 'MISSING_TENANT_PREDICATE' };
    }

    return { isCompliant: true };
  }
}
