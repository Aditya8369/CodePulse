import { UnauthorizedException } from '@nestjs/common';
import { TenantRlsService } from './tenant-rls.service';

describe('TenantRlsService', () => {
  let rls: TenantRlsService;

  beforeEach(() => {
    rls = new TenantRlsService();
  });

  afterEach(() => {
    rls.onModuleDestroy();
  });

  it('should establish tenant session parameters for PostgreSQL connection', () => {
    const session = rls.establishTenantSession({
      tenantId: 'tenant-alpha',
      userId: 'user-1',
      roles: ['USER'],
    });

    expect(session.sessionParamsSet['app.current_tenant_id']).toBe('tenant-alpha');
    expect(rls.getMetrics().totalSessionsEstablished).toBe(1);
  });

  it('should allow access to matching tenant records', () => {
    const session = rls.establishTenantSession({
      tenantId: 'tenant-beta',
      userId: 'user-2',
      roles: ['ADMIN'],
    });

    expect(() => rls.assertTenantAccess(session.sessionId, 'tenant-beta')).not.toThrow();
    expect(rls.getMetrics().totalQueriesGuarded).toBe(1);
  });

  it('should block cross-tenant data access and throw UnauthorizedException', () => {
    const session = rls.establishTenantSession({
      tenantId: 'tenant-alpha',
      userId: 'user-1',
      roles: ['USER'],
    });

    expect(() => rls.assertTenantAccess(session.sessionId, 'tenant-gamma')).toThrow(UnauthorizedException);
    expect(rls.getMetrics().unauthorizedCrossTenantAttempts).toBe(1);
  });

  it('should allow superadmin bypass across tenants', () => {
    const adminSession = rls.establishTenantSession({
      tenantId: 'root',
      userId: 'admin-1',
      roles: ['SUPERADMIN'],
      isSuperAdmin: true,
    });

    expect(() => rls.assertTenantAccess(adminSession.sessionId, 'tenant-xyz')).not.toThrow();
    expect(rls.getMetrics().superAdminBypasses).toBe(1);
  });
});
