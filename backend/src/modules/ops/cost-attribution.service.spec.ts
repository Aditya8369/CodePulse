import { CostAttributionService } from './cost-attribution.service';

describe('CostAttributionService (Real-Time Cloud FinOps & Quota Enforcement)', () => {
  let service: CostAttributionService;

  beforeEach(() => {
    service = new CostAttributionService();
  });

  it('accurately calculates execution compute and memory costs', () => {
    const cost = service.calculateExecutionCost({
      battleId: 'btl-finops-101',
      tenantId: 'org-university-alpha',
      cpuCores: 2,
      memoryMb: 1024,
      durationMs: 30000, // 30 seconds
      networkEgressKb: 500,
      isSpotInstance: false,
    });

    expect(cost.battleId).toBe('btl-finops-101');
    expect(cost.totalCostUsd).toBeGreaterThan(0);
    expect(cost.totalCostMicroCents).toBeGreaterThan(0);
    expect(cost.durationSeconds).toBe(30);
    expect(cost.pricingTier).toBe('ON_DEMAND');
  });

  it('applies ~68% discount when executing on Spot/Preemptible instances', () => {
    const onDemand = service.calculateExecutionCost({
      battleId: 'btl-od-1',
      tenantId: 'org-enterprise-beta',
      cpuCores: 4,
      memoryMb: 2048,
      durationMs: 60000,
      isSpotInstance: false,
    });

    const spot = service.calculateExecutionCost({
      battleId: 'btl-spot-1',
      tenantId: 'org-enterprise-beta',
      cpuCores: 4,
      memoryMb: 2048,
      durationMs: 60000,
      isSpotInstance: true,
    });

    expect(spot.totalCostUsd).toBeLessThan(onDemand.totalCostUsd);
    expect(spot.totalCostUsd / onDemand.totalCostUsd).toBeCloseTo(0.32, 1);
  });

  it('throttles tenant when daily expenditure exceeds quota limit', () => {
    expect(service.canExecute('org-university-alpha')).toBe(true);

    // Alpha current spend is 21.5, daily budget is 25.0
    // Inject large run that exceeds budget
    service.calculateExecutionCost({
      battleId: 'btl-heavy-99',
      tenantId: 'org-university-alpha',
      cpuCores: 16,
      memoryMb: 32768,
      durationMs: 3600000, // 1 hour heavy job -> ~$5
    });

    const budget = service.getTenantBudget('org-university-alpha');
    expect(budget?.isThrottled).toBe(true);
    expect(service.canExecute('org-university-alpha')).toBe(false);
  });

  it('generates FinOps report identifying waste and optimization recommendations', () => {
    service.calculateExecutionCost({
      battleId: 'b-1',
      tenantId: 'org-1',
      cpuCores: 2,
      memoryMb: 1024,
      durationMs: 10000,
    });

    const report = service.generateFinOpsReport();
    expect(report.totalExecutions).toBeGreaterThan(0);
    expect(report.totalSpendUsd).toBeGreaterThan(0);
    expect(report.estimatedWasteUsd).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
  });
});
