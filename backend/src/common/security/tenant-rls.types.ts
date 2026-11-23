/**
 * Dynamic Multi-Tenant Row-Level Security (RLS) Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  isSuperAdmin?: boolean;
}

export interface RlsSessionState {
  sessionId: string;
  context: TenantContext;
  sessionParamsSet: Record<string, string>;
  createdAt: number;
}

export interface RlsSecurityMetrics {
  totalSessionsEstablished: number;
  totalQueriesGuarded: number;
  unauthorizedCrossTenantAttempts: number;
  superAdminBypasses: number;
}
