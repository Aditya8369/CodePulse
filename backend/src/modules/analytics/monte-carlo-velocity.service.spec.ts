import { MonteCarloVelocityService } from './monte-carlo-velocity.service';

describe('MonteCarloVelocityService (10,000-Trial Forecasting & Risk Assessment)', () => {
  let service: MonteCarloVelocityService;

  beforeEach(() => {
    service = new MonteCarloVelocityService();
  });

  it('executes 10,000 Monte Carlo simulation runs in under 150ms with ordered P50 <= P85 <= P95 forecasts', () => {
    const history = [
      { date: '2026-11-01', completedTasks: 2 },
      { date: '2026-11-02', completedTasks: 5 },
      { date: '2026-11-03', completedTasks: 1 },
      { date: '2026-11-04', completedTasks: 4 },
      { date: '2026-11-05', completedTasks: 3 },
      { date: '2026-11-06', completedTasks: 0 },
      { date: '2026-11-07', completedTasks: 6 },
    ];

    const result = service.runMonteCarloForecast({
      remainingTasks: 30,
      history,
      iterations: 10_000,
      startDateIso: '2026-11-23T00:00:00.000Z',
      targetDeadlineIso: '2026-12-08T00:00:00.000Z',
      seed: 1337,
      backlogTasks: [
        {
          taskId: 'TASK-901',
          title: 'Distributed Raft Snapshot Compaction',
          storyPoints: 13,
          historicalVarianceCoeff: 0.72,
          blockedDependencies: 1,
        },
        {
          taskId: 'TASK-902',
          title: 'Update Footer Copyright Year',
          storyPoints: 1,
          historicalVarianceCoeff: 0.1,
        },
      ],
    });

    expect(result.iterations).toBe(10_000);
    expect(result.executionTimeMs).toBeLessThan(150);
    expect(result.percentiles.p50Days).toBeLessThanOrEqual(result.percentiles.p85Days);
    expect(result.percentiles.p85Days).toBeLessThanOrEqual(result.percentiles.p95Days);
    expect(result.fanChart.length).toBeGreaterThan(1);
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].taskId).toBe('TASK-901');
  });
});
