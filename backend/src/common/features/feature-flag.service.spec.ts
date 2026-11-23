import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService (Canary & Auto-Rollback Engine)', () => {
  let service: FeatureFlagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureFlagService],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
  });

  it('should be defined with seeded default flags', () => {
    expect(service).toBeDefined();
    const flag = service.getFlag('battle.realtime-engine-v2');
    expect(flag).toBeDefined();
    expect(flag?.canaryPercentage).toBe(10);
    expect(flag?.version).toBe('v2');
  });

  describe('Targeting Overrides', () => {
    it('should route specifically targeted user IDs to canary version', async () => {
      const result = await service.evaluateFlag('battle.realtime-engine-v2', {
        userId: 'beta-tester-1',
      });

      expect(result.isEnabled).toBe(true);
      expect(result.variant).toBe('v2');
      expect(result.reason).toBe('TARGETED_USER');
    });

    it('should route targeted regions to canary version', async () => {
      const result = await service.evaluateFlag('battle.realtime-engine-v2', {
        region: 'us-east-1',
      });

      expect(result.isEnabled).toBe(true);
      expect(result.variant).toBe('v2');
      expect(result.reason).toBe('TARGETED_REGION');
    });

    it('should route targeted guild affiliations to canary version', async () => {
      const result = await service.evaluateFlag('battle.realtime-engine-v2', {
        guildId: 'alpha-coders',
      });

      expect(result.isEnabled).toBe(true);
      expect(result.variant).toBe('v2');
      expect(result.reason).toBe('TARGETED_GUILD');
    });
  });

  describe('Percentage-Based Canary Rollout', () => {
    it('should route untargeted users according to percentage allocation', async () => {
      service.promoteCanary('battle.realtime-engine-v2', 50);

      const eval1 = await service.evaluateFlag('battle.realtime-engine-v2', { userId: 'user-a' });
      const eval2 = await service.evaluateFlag('battle.realtime-engine-v2', { userId: 'user-b' });

      expect(['v1', 'v2']).toContain(eval1.variant);
      expect(['v1', 'v2']).toContain(eval2.variant);
    });
  });

  describe('Error Rate Monitoring & Instant Auto-Rollback (> 1% 5xx errors)', () => {
    it('should automatically trigger rollback when 5xx error rate exceeds 1%', async () => {
      const flagKey = 'battle.realtime-engine-v2';

      // Record 10 healthy requests
      for (let i = 0; i < 10; i++) {
        service.recordRequestMetric(flagKey, 200);
      }
      expect(service.getFlag(flagKey)?.rolledBack).toBe(false);

      // Record 5xx errors driving error rate above 1%
      service.recordRequestMetric(flagKey, 500);

      const flag = service.getFlag(flagKey);
      expect(flag?.rolledBack).toBe(true);
      expect(flag?.canaryPercentage).toBe(0);
      expect(flag?.rollbackReason).toBeDefined();

      // Ensure subsequent user evaluations fall back to stable v1
      const evalAfterRollback = await service.evaluateFlag(flagKey, { userId: 'beta-tester-1' });
      expect(evalAfterRollback.isEnabled).toBe(false);
      expect(evalAfterRollback.variant).toBe('v1');
      expect(evalAfterRollback.reason).toBe('AUTO_ROLLED_BACK');
    });
  });

  describe('Canary Promotion Lifecycle', () => {
    it('should support incremental promotion and clear rollback states', () => {
      const flagKey = 'battle.realtime-engine-v2';
      service.triggerAutoRollback(flagKey, 'manual drill');

      expect(service.getFlag(flagKey)?.rolledBack).toBe(true);

      service.promoteCanary(flagKey, 25);
      const updated = service.getFlag(flagKey);

      expect(updated?.rolledBack).toBe(false);
      expect(updated?.canaryPercentage).toBe(25);
      expect(updated?.totalRequests).toBe(0);
    });
  });
});
