import { SetMetadata } from '@nestjs/common';

export interface OpaPolicyMetadata {
  action: string;
  resourceType: string;
  extractTenantFromParam?: string; // param name e.g. 'tenantId' or 'orgId'
  extractResourceFromParam?: string; // param name e.g. 'battleId'
}

export const OPA_POLICY_KEY = 'opa_policy';

export const RequireOpaPolicy = (
  action: string,
  resourceType: string,
  options?: { extractTenantFromParam?: string; extractResourceFromParam?: string },
) =>
  SetMetadata(OPA_POLICY_KEY, {
    action,
    resourceType,
    ...options,
  });
