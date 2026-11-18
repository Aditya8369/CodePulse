import { DifferentialPrivacyService } from './differential-privacy.service';

describe('DifferentialPrivacyService (Laplace/Gaussian Noise & Privacy Budget)', () => {
  let dp: DifferentialPrivacyService;

  beforeEach(() => {
    dp = new DifferentialPrivacyService({
      defaultEpsilon: 1.0,
      defaultDelta: 1e-5,
      minCohortSize: 5,
    });
  });

  it('samples Laplace noise and adds calibrated noise preserving statistical accuracy within 3%', () => {
    const trueValue = 1000;
    const samples: number[] = [];
    for (let i = 0; i < 500; i++) {
      samples.push(dp.addLaplaceNoise(trueValue, 1.0, 1.0));
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const errorPercent = Math.abs(mean - trueValue) / trueValue * 100;

    expect(errorPercent).toBeLessThan(3.0);
    expect(samples.some((s) => s !== trueValue)).toBe(true);
  });

  it('adds Gaussian noise for approximate (epsilon, delta)-differential privacy', () => {
    const trueValue = 500;
    const noisy = dp.addGaussianNoise(trueValue, 1.0, 1.0, 1e-5);
    expect(typeof noisy).toBe('number');
    expect(Math.abs(noisy - trueValue)).toBeLessThan(50);
  });

  it('suppresses cohorts where size N < 5 (k-anonymity protection)', () => {
    const smallCohort = [
      { commitCount: 12 },
      { commitCount: 8 },
      { commitCount: 3 },
    ];

    const result = dp.privatizeQuery(smallCohort, (item) => item.commitCount, {
      consumerKey: 'user-a',
    });

    expect(result.cohortSize).toBe(3);
    expect(result.suppressed).toBe(true);
    expect(result.noisyValue).toBeNull();
  });

  it('applies Laplace noise and returns privatized aggregate for cohorts with N >= 5', () => {
    const validCohort = [
      { commitCount: 10 },
      { commitCount: 15 },
      { commitCount: 20 },
      { commitCount: 25 },
      { commitCount: 30 },
    ];

    const result = dp.privatizeQuery(validCohort, (item) => item.commitCount, {
      consumerKey: 'user-b',
      epsilon: 1.0,
    });

    expect(result.cohortSize).toBe(5);
    expect(result.suppressed).toBe(false);
    expect(typeof result.noisyValue).toBe('number');
  });

  it('tracks cumulative privacy loss and enforces privacy budget limits (throws when budget exceeded)', () => {
    const key = 'analyst-1';
    dp.consumeBudget(key, 4.0, 1e-5, 10.0);
    const status1 = dp.getBudgetStatus(key, 10.0);
    expect(status1.epsilonConsumed).toBe(4.0);
    expect(status1.queriesExecuted).toBe(1);

    dp.consumeBudget(key, 5.5, 1e-5, 10.0);
    expect(dp.getBudgetStatus(key, 10.0).epsilonConsumed).toBe(9.5);

    expect(() => {
      dp.consumeBudget(key, 1.0, 1e-5, 10.0);
    }).toThrow(/Privacy budget exhausted/);
  });
});
