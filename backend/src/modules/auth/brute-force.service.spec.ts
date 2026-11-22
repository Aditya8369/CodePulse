import { Test, TestingModule } from '@nestjs/testing';
import { BruteForceService } from './brute-force.service';
import { RedisService } from '../../common/redis/redis.service';

describe('BruteForceService (#312 Distributed Brute-Force Protection & Account Lockout)', () => {
  let service: BruteForceService;
  let redisService: RedisService;

  beforeEach(async () => {
    redisService = new RedisService();
    redisService.clearMemoryStores();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BruteForceService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<BruteForceService>(BruteForceService);
  });

  afterEach(() => {
    redisService.clearMemoryStores();
  });

  describe('Multi-IP Distributed Attack Detection', () => {
    it('locks out target account after 5 failed attempts across rotating proxy IPs', async () => {
      const targetUser = 'victim_developer';

      // 4 failed attempts from 4 distinct rotating IPs
      for (let i = 1; i <= 4; i++) {
        const rotatingIp = `198.51.100.${i}`;
        const result = await service.recordFailedAttempt(targetUser, rotatingIp);
        expect(result.attempts).toBe(i);
        expect(result.isLocked).toBe(false);
      }

      // 5th attempt from a 5th rotating IP triggers account lockout
      const fifthAttempt = await service.recordFailedAttempt(targetUser, '198.51.100.5');
      expect(fifthAttempt.attempts).toBe(5);
      expect(fifthAttempt.isLocked).toBe(true);
      expect(fifthAttempt.lockoutDurationSeconds).toBe(300); // 5-minute lockout

      // Verify that Redis lockout key was stored: lockout:user:<username>
      const storedLockout = await redisService.get(`lockout:user:${targetUser}`);
      expect(storedLockout).toBeDefined();
      expect(JSON.parse(storedLockout!).attemptCount).toBe(5);

      // Even a completely new 6th rotating IP cannot access the locked account
      const lockoutStatus = await service.getLockout(targetUser, '198.51.100.6');
      expect(lockoutStatus.isLocked).toBe(true);
      expect(lockoutStatus.retryAfterSeconds).toBeGreaterThan(0);
      expect(lockoutStatus.requiresEmailUnlock).toBe(false);
    });
  });

  describe('Exponential Backoff Lockout Policies', () => {
    it('escalates to 30-minute lockout at 8 failed attempts', async () => {
      const username = 'test_user_escalate';

      for (let i = 1; i <= 7; i++) {
        await service.recordFailedAttempt(username, `10.0.0.${i}`);
      }

      const eighth = await service.recordFailedAttempt(username, '10.0.0.8');
      expect(eighth.attempts).toBe(8);
      expect(eighth.isLocked).toBe(true);
      expect(eighth.lockoutDurationSeconds).toBe(1800); // 30 minutes
      expect(eighth.requiresEmailUnlock).toBe(false);

      const status = await service.getLockout(username);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
      expect(status.lockoutTier).toContain('30-minute');
    });

    it('escalates to 24-hour lockout requiring email unlock at 10 failed attempts', async () => {
      const username = 'emergency_target';

      for (let i = 1; i <= 9; i++) {
        await service.recordFailedAttempt(username, `10.0.0.${i}`);
      }

      const tenth = await service.recordFailedAttempt(username, '10.0.0.10');
      expect(tenth.attempts).toBe(10);
      expect(tenth.isLocked).toBe(true);
      expect(tenth.lockoutDurationSeconds).toBe(86400); // 24 hours
      expect(tenth.requiresEmailUnlock).toBe(true);

      const status = await service.getLockout(username);
      expect(status.isLocked).toBe(true);
      expect(status.requiresEmailUnlock).toBe(true);
      expect(status.lockoutTier).toContain('24-hour');
    });
  });

  describe('Reset on Successful Login & Admin Unlock', () => {
    it('resets failed attempt counter to 0 upon successful login', async () => {
      const username = 'reset_user';
      await service.recordFailedAttempt(username, '192.168.1.1');
      await service.recordFailedAttempt(username, '192.168.1.2');

      let status = await service.getLockout(username);
      expect(status.attemptCount).toBe(2);

      await service.recordSuccessfulLogin(username, '192.168.1.3');

      status = await service.getLockout(username);
      expect(status.attemptCount).toBe(0);
      expect(status.isLocked).toBe(false);
    });

    it('manually unlocks account and clears Redis lockout keys via admin unlock', async () => {
      const username = 'locked_admin_unlock';
      // Trigger lockout
      for (let i = 1; i <= 5; i++) {
        await service.recordFailedAttempt(username, `10.1.1.${i}`);
      }

      let status = await service.getLockout(username);
      expect(status.isLocked).toBe(true);

      // Admin performs unlock
      const unlocked = await service.unlockUser(username);
      expect(unlocked).toBe(true);

      status = await service.getLockout(username);
      expect(status.isLocked).toBe(false);
      expect(status.attemptCount).toBe(0);
      expect(await redisService.get(`lockout:user:${username}`)).toBeNull();
    });
  });

  describe('Automated Security Alert Email Dispatch', () => {
    it('dispatches automated lockout notification email with unlock token', async () => {
      const res = await service.dispatchLockoutAlertEmail({
        username: 'alice_dev',
        email: 'alice@codepulse.dev',
        ip: '198.51.100.99',
        attemptCount: 5,
        durationSeconds: 300,
        requiresEmailUnlock: false,
        unlockToken: 'test-token-12345',
      });

      expect(res.sent).toBe(true);
      expect(res.alertId).toBeDefined();
      expect(['resend_api', 'bullmq_alert_worker']).toContain(res.provider);
    });
  });
});
