import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OpaEngineService } from './opa-engine.service';
import { OpaPolicyGuard } from './opa-policy.guard';
import { OPA_POLICY_KEY } from './opa-policy.decorator';

describe('OpaEngineService & OpaPolicyGuard', () => {
  let engine: OpaEngineService;
  let guard: OpaPolicyGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpaEngineService, OpaPolicyGuard, Reflector],
    }).compile();

    engine = module.get<OpaEngineService>(OpaEngineService);
    guard = module.get<OpaPolicyGuard>(OpaPolicyGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('OpaEngineService in-memory evaluation (<0.8ms)', () => {
    it('should complete evaluation in under 0.8ms', () => {
      const res = engine.evaluate({
        user: { id: 'u1', roles: ['MEMBER'], tenantId: 'tenant_a' },
        action: 'execute_code',
        resource: { type: 'challenge', tenantId: 'tenant_a' },
        context: { clientIp: '127.0.0.1' },
      });

      expect(res.allow).toBe(true);
      expect(res.evaluationDurationMs).toBeLessThan(0.8);
      expect(res.matchedRules).toContain('RBAC_CHALLENGE_CODE_EXECUTION');
    });

    it('should allow SUPER_ADMIN unconditionally', () => {
      const res = engine.evaluate({
        user: { id: 'admin1', roles: ['SUPER_ADMIN'], tenantId: 'any' },
        action: 'destroy_database',
        resource: { type: 'system', tenantId: 'other' },
        context: { clientIp: '10.0.0.1' },
      });

      expect(res.allow).toBe(true);
      expect(res.matchedRules).toContain('SUPER_ADMIN_UNCONDITIONAL_BYPASS');
    });

    it('should deny cross-tenant resource access', () => {
      const res = engine.evaluate({
        user: { id: 'u2', roles: ['ADMIN'], tenantId: 'tenant_a' },
        action: 'create_repo',
        resource: { type: 'repository', tenantId: 'tenant_b' },
        context: { clientIp: '127.0.0.1' },
      });

      expect(res.allow).toBe(false);
      expect(res.denyReasons[0]).toContain('Cross-tenant violation');
    });

    it('should enforce contextual battle inspection rule (only LEAD or participant can view code during battle)', () => {
      // Normal MEMBER who is not participant -> DENIED
      const deniedRes = engine.evaluate({
        user: { id: 'spectator_1', roles: ['MEMBER'], tenantId: 'tenant_a' },
        action: 'view_code',
        resource: {
          type: 'battle_session',
          tenantId: 'tenant_a',
          battleState: 'in_progress',
          participants: ['player_1', 'player_2'],
        },
        context: { clientIp: '127.0.0.1' },
      });
      expect(deniedRes.allow).toBe(false);
      expect(deniedRes.denyReasons[0]).toContain('Contextual ABAC rejection');

      // Team LEAD -> ALLOWED
      const leadRes = engine.evaluate({
        user: { id: 'lead_1', roles: ['LEAD'], tenantId: 'tenant_a' },
        action: 'view_code',
        resource: {
          type: 'battle_session',
          tenantId: 'tenant_a',
          battleState: 'in_progress',
          participants: ['player_1', 'player_2'],
        },
        context: { clientIp: '127.0.0.1' },
      });
      expect(leadRes.allow).toBe(true);
      expect(leadRes.matchedRules).toContain('ABAC_BATTLE_LEAD_CODE_INSPECT');

      // Participant -> ALLOWED
      const participantRes = engine.evaluate({
        user: { id: 'player_1', roles: ['MEMBER'], tenantId: 'tenant_a' },
        action: 'view_code',
        resource: {
          type: 'battle_session',
          tenantId: 'tenant_a',
          battleState: 'in_progress',
          participants: ['player_1', 'player_2'],
        },
        context: { clientIp: '127.0.0.1' },
      });
      expect(participantRes.allow).toBe(true);
      expect(participantRes.matchedRules).toContain('ABAC_BATTLE_PARTICIPANT_CODE_INSPECT');
    });

    it('should deny access if client IP is not in whitelist', () => {
      const res = engine.evaluate({
        user: { id: 'u3', roles: ['ADMIN'], tenantId: 'tenant_a' },
        action: 'create_repo',
        resource: { type: 'repository', tenantId: 'tenant_a' },
        context: {
          clientIp: '203.0.113.55',
          ipWhitelist: ['192.168.1.1', '10.0.0.1'],
        },
      });

      expect(res.allow).toBe(false);
      expect(res.denyReasons[0]).toContain('IP authorization failure');
    });

    it('should deny access during maintenance window', () => {
      const res = engine.evaluate({
        user: { id: 'u4', roles: ['ADMIN'], tenantId: 'tenant_a' },
        action: 'create_repo',
        resource: { type: 'repository', tenantId: 'tenant_a' },
        context: {
          clientIp: '127.0.0.1',
          maintenanceWindow: true,
        },
      });

      expect(res.allow).toBe(false);
      expect(res.denyReasons[0]).toContain('scheduled maintenance');
    });
  });

  describe('OpaPolicyGuard NestJS Execution', () => {
    it('should pass if no OPA metadata is attached to route', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException with exact rule traces when denied', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        action: 'view_code',
        resourceType: 'battle_session',
      });

      const mockReq: any = {
        user: { id: 'stranger', roles: ['MEMBER'], tenantId: 'tenant_x' },
        headers: {},
        params: {},
        body: { battleState: 'in_progress', participants: ['p1', 'p2'] },
      };

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => mockReq }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });
});
