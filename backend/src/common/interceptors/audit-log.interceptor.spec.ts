import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from '../../modules/admin/audit-log.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';

describe('AuditLogInterceptor (#313 Security Audit Log Trail Interceptor)', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  beforeEach(async () => {
    auditLogService = {
      logAction: jest.fn().mockResolvedValue({ id: 'audit-mock-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        Reflector,
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(
    metadata: any,
    user?: any,
    params: any = {},
    body: any = {},
    headers: any = {},
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(metadata);

    const req = {
      user,
      params,
      body,
      query: {},
      headers: {
        'x-forwarded-for': '198.51.100.77',
        'user-agent': 'JestAuditTester/1.0',
        ...headers,
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => () => {},
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  it('passes through directly when endpoint is not annotated with @AuditAction', (done) => {
    const context = createMockContext(null);
    const callHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(auditLogService.logAction).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('logs action asynchronously upon successful response completion', (done) => {
    const metadata = {
      action: 'USER_DELETED',
      targetType: 'USER',
      targetIdParam: 'id',
      description: 'Administrative user deletion',
    };
    const user = { id: 'admin-99', email: 'secadmin@codepulse.dev' };
    const params = { id: 'target-user-123' };
    const context = createMockContext(metadata, user, params);

    const callHandler: CallHandler = {
      handle: () => of({ success: true, message: 'User deleted' }),
    };

    interceptor.intercept(context, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true, message: 'User deleted' });

        setImmediate(() => {
          expect(auditLogService.logAction).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'USER_DELETED',
              actorId: 'admin-99',
              actorEmail: 'secadmin@codepulse.dev',
              targetId: 'target-user-123',
              targetType: 'USER',
              ipAddress: '198.51.100.77',
              userAgent: 'JestAuditTester/1.0',
            }),
          );
          done();
        });
      },
    });
  });

  it('records failure audit entry when action throws an exception', (done) => {
    const metadata = {
      action: 'MAINTENANCE_TOGGLED',
      targetType: 'SYSTEM',
    };
    const user = { id: 'admin-50', email: 'ops@codepulse.dev' };
    const context = createMockContext(metadata, user);

    const error = new Error('Database locked');
    const callHandler: CallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(context, callHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);

        setImmediate(() => {
          expect(auditLogService.logAction).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'MAINTENANCE_TOGGLED_FAILED',
              actorId: 'admin-50',
              targetType: 'SYSTEM',
              metadata: expect.objectContaining({
                outcome: 'FAILURE',
                errorMessage: 'Database locked',
              }),
            }),
          );
          done();
        });
      },
    });
  });
});
