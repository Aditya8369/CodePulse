import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { QueuesAdminGuard } from './queues-admin.guard';
import { QueuesController } from './queues.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
const context = (user?: { id: string }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;
describe('queue recovery authorization', () => {
  const guard = (value?: string) =>
    new QueuesAdminGuard({ get: () => value } as unknown as ConfigService);
  it('fails closed with missing configuration, missing JWT user and ordinary users', () => {
    expect(() => guard().canActivate(context({ id: 'u' }))).toThrow();
    expect(() => guard('u').canActivate(context())).toThrow();
    expect(() => guard('admin').canActivate(context({ id: 'u' }))).toThrow();
  });
  it('accepts exact configured administrator ids only', () => {
    expect(guard(' a, admin ').canActivate(context({ id: 'admin' }))).toBe(
      true,
    );
    expect(() =>
      guard('administrator').canActivate(context({ id: 'admin' })),
    ).toThrow();
  });
  it('puts authentication before administrator authorization on replay and metric routes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, QueuesController)).toEqual([
      JwtAuthGuard,
      QueuesAdminGuard,
    ]);
  });
});
