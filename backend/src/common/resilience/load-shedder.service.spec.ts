import { Test, TestingModule } from '@nestjs/testing';
import { LoadShedderService, PriorityTier } from './load-shedder.service';

describe('LoadShedderService', () => {
  let service: LoadShedderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoadShedderService],
    }).compile();

    service = module.get<LoadShedderService>(LoadShedderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Endpoint Priority Classification', () => {
    it('should classify battle submission and execution endpoints as CRITICAL (Tier 1)', () => {
      expect(service.classifyPriority('/api/battles/submit')).toBe(PriorityTier.CRITICAL);
      expect(service.classifyPriority('/api/battles/live/room1')).toBe(PriorityTier.CRITICAL);
      expect(service.classifyPriority('/api/execution/run')).toBe(PriorityTier.CRITICAL);
    });

    it('should classify analytics and telemetry endpoints as LOW (Tier 3)', () => {
      expect(service.classifyPriority('/api/analytics/summary')).toBe(PriorityTier.LOW);
      expect(service.classifyPriority('/api/telemetry/traces')).toBe(PriorityTier.LOW);
      expect(service.classifyPriority('/api/reports/monthly')).toBe(PriorityTier.LOW);
    });

    it('should classify leaderboard and profile queries as STANDARD (Tier 2)', () => {
      expect(service.classifyPriority('/api/leaderboards/global')).toBe(PriorityTier.STANDARD);
      expect(service.classifyPriority('/api/users/profile')).toBe(PriorityTier.STANDARD);
    });
  });

  describe('Adaptive Load Shedding Under High Load', () => {
    it('should admit all priority tiers under normal operating conditions', () => {
      const normalMetrics = { cpuUsagePercent: 40.0, queueDepth: 120 };

      const crit = service.shouldAdmitRequest(PriorityTier.CRITICAL, normalMetrics);
      const std = service.shouldAdmitRequest(PriorityTier.STANDARD, normalMetrics);
      const low = service.shouldAdmitRequest(PriorityTier.LOW, normalMetrics);

      expect(crit.admit).toBe(true);
      expect(std.admit).toBe(true);
      expect(low.admit).toBe(true);
    });

    it('should drop LOW priority (analytics) with 503 Retry-After when CPU > 85%', () => {
      const highCpuMetrics = { cpuUsagePercent: 88.0, queueDepth: 200 };

      const lowDecision = service.shouldAdmitRequest(PriorityTier.LOW, highCpuMetrics);
      expect(lowDecision.admit).toBe(false);
      expect(lowDecision.statusCode).toBe(503);
      expect(lowDecision.retryAfterSeconds).toBe(30);

      // CRITICAL must still be admitted
      const critDecision = service.shouldAdmitRequest(PriorityTier.CRITICAL, highCpuMetrics);
      expect(critDecision.admit).toBe(true);
    });

    it('should drop LOW priority when queue depth exceeds 1000', () => {
      const deepQueueMetrics = { cpuUsagePercent: 60.0, queueDepth: 1250 };

      const lowDecision = service.shouldAdmitRequest(PriorityTier.LOW, deepQueueMetrics);
      expect(lowDecision.admit).toBe(false);
      expect(lowDecision.statusCode).toBe(503);
    });
  });

  describe('10x Traffic Spike Simulation (Acceptance Criteria)', () => {
    it('should guarantee 100% of active battle code submissions succeed without interruption during 10x spikes', () => {
      const result = service.simulateTrafficSpike(10);

      expect(result.criticalZeroDropped).toBe(true);
      expect(result.criticalAdmittedPercent).toBe(100.0);
      expect(result.lowShedPercent).toBe(100.0);
      expect(result.spikeMultiplier).toBe(10);
    });
  });
});
