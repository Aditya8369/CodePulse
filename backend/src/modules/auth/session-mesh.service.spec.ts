import { UnauthorizedException } from '@nestjs/common';
import { SessionMeshService, ClientConnectionSocket } from './session-mesh.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('Distributed Zero-Latency Session Revocation Mesh', () => {
  let sessionMesh: SessionMeshService;

  beforeEach(() => {
    sessionMesh = new SessionMeshService();
    sessionMesh.onModuleInit();
  });

  afterEach(() => {
    sessionMesh.onModuleDestroy();
  });

  describe('Session Revocation & Local Bloom Filter', () => {
    it('returns false for legitimate non-revoked sessions with zero overhead', () => {
      const isRevoked = sessionMesh.isSessionRevoked('sess-100', 'user-100');
      expect(isRevoked).toBe(false);
    });

    it('revoking a single session blocks it immediately while keeping other user sessions active', () => {
      sessionMesh.revokeSession('sess-device-a', 'user-42');

      expect(sessionMesh.isSessionRevoked('sess-device-a', 'user-42')).toBe(true);
      expect(sessionMesh.isSessionRevoked('sess-device-b', 'user-42')).toBe(false);
    });

    it('revoking all user sessions immediately blocks all tokens issued prior to revocation', () => {
      const beforeTime = Date.now() - 5000;
      sessionMesh.revokeAllUserSessions('user-compromised');

      expect(sessionMesh.isSessionRevoked('any-session-1', 'user-compromised', beforeTime)).toBe(true);
      expect(sessionMesh.isSessionRevoked('any-session-2', 'user-compromised')).toBe(true);
      expect(sessionMesh.isSessionRevoked('sess-safe', 'user-safe')).toBe(false);
    });
  });

  describe('SSE & WebSocket Kill-Switch', () => {
    it('immediately sends kill signal and disconnects active sockets when session or user is revoked', () => {
      const sendKillSignal = jest.fn();
      const disconnect = jest.fn();

      const socket: ClientConnectionSocket = {
        id: 'sock-1',
        userId: 'user-to-kick',
        sessionId: 'sess-kick',
        sendKillSignal,
        disconnect,
      };

      sessionMesh.registerClientConnection(socket);
      expect(sessionMesh.getActiveSocketCount()).toBe(1);

      // Trigger revocation
      sessionMesh.revokeAllUserSessions('user-to-kick', 'Security Policy Enforcement');

      expect(sendKillSignal).toHaveBeenCalledWith('Security Policy Enforcement');
      expect(disconnect).toHaveBeenCalledWith(true);
      expect(sessionMesh.getActiveSocketCount()).toBe(0);
    });
  });

  describe('Throughput Benchmark (<20ms for 10,000 Lookups)', () => {
    it('executes 10,000 in-memory validation checks in under 20ms', () => {
      // Seed 100 revoked sessions
      for (let i = 0; i < 100; i++) {
        sessionMesh.revokeSession(`revoked-${i}`, `user-${i}`);
      }

      const startTime = performance.now();
      for (let i = 0; i < 10000; i++) {
        sessionMesh.isSessionRevoked(`sess-${i}`, `user-${i}`);
      }
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(20);
    });
  });

  describe('AuthGuard Integration', () => {
    it('allows valid sessions and throws UnauthorizedException on revoked sessions', () => {
      const guard = new AuthGuard(sessionMesh);

      const mockValidContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-session-id': 'sess-valid', 'x-user-id': 'user-valid' },
          }),
        }),
      } as any;

      expect(guard.canActivate(mockValidContext)).toBe(true);

      // Revoke and test again
      sessionMesh.revokeSession('sess-valid', 'user-valid');
      expect(() => guard.canActivate(mockValidContext)).toThrow(UnauthorizedException);
    });
  });
});
