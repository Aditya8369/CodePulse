import { Injectable, Logger, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { RlsSecurityMetrics, RlsSessionState, TenantContext } from './tenant-rls.types';

@Injectable()
export class TenantRlsService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantRlsService.name);

  private readonly activeSessions = new Map<string, RlsSessionState>();
  private totalEstablished = 0;
  private totalQueriesGuarded = 0;
  private unauthorizedAttempts = 0;
  private adminBypasses = 0;

  public onModuleDestroy(): void {
    this.activeSessions.clear();
  }

  /**
   * Establishes contextual tenant parameters for PostgreSQL session (SET LOCAL app.current_tenant_id).
   */
  public establishTenantSession(context: TenantContext): RlsSessionState {
    this.totalEstablished++;
    const sessionId = `rls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const state: RlsSessionState = {
      sessionId,
      context,
      sessionParamsSet: {
        'app.current_tenant_id': context.tenantId,
        'app.current_user_id': context.userId,
      },
      createdAt: Date.now(),
    };

    this.activeSessions.set(sessionId, state);
    return state;
  }

  /**
   * Asserts query target belongs to the caller's active tenant.
   * Throws UnauthorizedException if cross-tenant data leak is attempted.
   */
  public assertTenantAccess(sessionId: string, targetTenantId: string): void {
    this.totalQueriesGuarded++;
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      this.unauthorizedAttempts++;
      throw new UnauthorizedException('[RLS Security] Missing or invalid tenant session context.');
    }

    if (session.context.isSuperAdmin) {
      this.adminBypasses++;
      return; // Super admin permitted
    }

    if (session.context.tenantId !== targetTenantId) {
      this.unauthorizedAttempts++;
      this.logger.warn(
        `[RLS Alert] Cross-tenant leak blocked! User ${session.context.userId} (Tenant: ${session.context.tenantId}) attempted access to Tenant ${targetTenantId}`,
      );
      throw new UnauthorizedException(`[RLS-Denied] Access denied: Data belongs to tenant ${targetTenantId}.`);
    }
  }

  public endTenantSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  public getMetrics(): RlsSecurityMetrics {
    return {
      totalSessionsEstablished: this.totalEstablished,
      totalQueriesGuarded: this.totalQueriesGuarded,
      unauthorizedCrossTenantAttempts: this.unauthorizedAttempts,
      superAdminBypasses: this.adminBypasses,
    };
  }
}
