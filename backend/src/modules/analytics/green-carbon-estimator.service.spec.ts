import { GreenCarbonEstimatorService } from './green-carbon-estimator.service';

describe('GreenCarbonEstimatorService (RAPL/Perf Counters, Carbon Math & Green Code Badges)', () => {
  let service: GreenCarbonEstimatorService;

  beforeEach(() => {
    service = new GreenCarbonEstimatorService();
  });

  it('parses Intel RAPL microjoule counter deltas (including wraparound) and AMD perf stat output accurately', () => {
    const raplSample = service.parseIntelRaplDelta({
      pkgBeforeUj: 1_500_000,
      pkgAfterUj: 1_920_000,
      dramBeforeUj: 300_000,
      dramAfterUj: 380_000,
      durationMs: 250,
    });

    expect(raplSample.cpuEnergyMj).toBe(420);
    expect(raplSample.dramEnergyMj).toBe(80);
    expect(raplSample.totalEnergyMj).toBe(500);
    expect(raplSample.totalEnergyJoules).toBe(0.5);
    expect(raplSample.averagePowerWatts).toBe(2);

    const perfOutput = `
     Performance counter stats for 'npm test':

              1.45 Joules power/energy-pkg/
              0.35 Joules power/energy-ram/

       0.600123456 seconds time elapsed
    `;
    const perfSample = service.parsePerfStatEnergyOutput(perfOutput, 600);
    expect(perfSample.cpuEnergyMj).toBe(1450);
    expect(perfSample.dramEnergyMj).toBe(350);
    expect(perfSample.totalEnergyMj).toBe(1800);
  });

  it('applies regional grid carbon intensity factors, detects O(N^2) energy hotspots, and awards Green Code badges', () => {
    // Low-energy O(N) run in Stockholm (eu-north-1: 13 gCO2eq/kWh) -> earns Platinum Leaf badge
    const greenRun = service.estimateExecutionCarbon({
      runId: 'run-opt-1',
      repositoryId: 'repo-green',
      region: 'aws:eu-north-1',
      cpuEnergyMj: 160,
      dramEnergyMj: 40,
      durationMs: 85,
      sourceCode: `
        function twoSum(nums: number[], target: number) {
          const seen = new Map<number, number>();
          for (let i = 0; i < nums.length; i++) {
            if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
            seen.set(nums[i], i);
          }
        }
      `,
    });

    expect(greenRun.greenCodeBadge.awarded).toBe(true);
    expect(greenRun.greenCodeBadge.tier).toBe('PLATINUM_LEAF');
    expect(greenRun.co2SavingsPercent).toBeGreaterThan(95);
    expect(greenRun.algorithmicHotspots).toHaveLength(0);

    // High-energy O(N^2) run in Mumbai (ap-south-1: 632 gCO2eq/kWh) -> flags hotspot & denies Green badge
    const quadraticRun = service.estimateExecutionCarbon({
      runId: 'run-slow-2',
      repositoryId: 'repo-green',
      region: 'aws:ap-south-1',
      cpuEnergyMj: 3200,
      dramEnergyMj: 800,
      durationMs: 1400,
      sourceCode: `
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            total += matrix[i][j];
          }
        }
      `,
    });

    expect(quadraticRun.estimatedCo2Grams).toBeGreaterThan(greenRun.estimatedCo2Grams * 100);
    expect(quadraticRun.algorithmicHotspots).toHaveLength(1);
    expect(quadraticRun.algorithmicHotspots[0].estimatedComplexity).toBe('O(N^2)');
    expect(quadraticRun.greenCodeBadge.awarded).toBe(false);
  });
});
