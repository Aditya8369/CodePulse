import { NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {};
    service = new SessionService(mockPrisma);
  });

  it('lists active user sessions with current session marked', async () => {
    const sessions = await service.listUserSessions('user-123', 'sess-my-device');
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const current = sessions.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current?.id).toBe('sess-my-device');
    expect(current?.userId).toBe('user-123');
  });

  it('revokes an individual remote session', async () => {
    const res = await service.revokeSession('user-123', 'sess-remote-456');
    expect(res).toEqual({
      success: true,
      revokedSessionId: 'sess-remote-456',
    });
  });

  it('throws NotFoundException when attempting to revoke current session directly', async () => {
    await expect(
      service.revokeSession('user-123', 'sess-current'),
    ).rejects.toThrow(NotFoundException);
  });

  it('revokes all other remote sessions', async () => {
    const res = await service.revokeOtherSessions('user-123', 'sess-my-device');
    expect(res.success).toBe(true);
    expect(res.message).toContain('revoked');
  });
});
