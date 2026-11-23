import { GoldenSignalsForecasterService } from './golden-signals-forecaster.service';

describe('GoldenSignalsForecasterService (Holt-Winters, 3-Sigma Bounds, 20m Leak Forecast)', () => {
  let service: GoldenSignalsForecasterService;

  beforeEach(() => {
    service = new GoldenSignalsForecasterService();
  });

  it('reduces false-positive alert noise by >=70% during normal diurnal peaks compared to static thresholds', () => {
    // 72 hourly samples (3 days) with smooth daily sine wave peaking at 86% CPU every afternoon
    const samples = Array.from({ length: 72 }, (_, h) => ({
      timestampMs: 1_700_000_000_000 + h * 3_600_000,
      value: 55 + 31 * Math.sin((2 * Math.PI * h) / 24),
    }));

    const comparison = service.compareNoiseVsStaticThreshold({
      signal: 'SATURATION',
      samples,
      staticThreshold: 80, // Static >80% triggers repeatedly every afternoon
      config: { dailySeasonPeriod: 24, weeklySeasonPeriod: 24 },
    });

    expect(comparison.staticAlertCount).toBeGreaterThanOrEqual(8);
    expect(comparison.falsePositiveReductionPercent).toBeGreaterThanOrEqual(70);
  });

  it('detects memory leak trajectory 20 minutes before OOM threshold and fires Slack/Discord/PagerDuty webhooks on >3 sigma anomaly', async () => {
    // Steady linear memory leak creeping from 500MB toward 1024MB critical limit
    const leakSamples = Array.from({ length: 30 }, (_, m) => ({
      timestampMs: 1_700_000_000_000 + m * 60_000,
      value: 520 + m * 12, // Currently 868MB (< 1024MB), but +12MB/min reaches 1108MB in 20 mins
    }));

    const leakEval = service.evaluateGoldenSignal({
      signal: 'SATURATION',
      samples: leakSamples,
      criticalCapacityThreshold: 1024,
      horizonMinutes: 20,
      config: { dailySeasonPeriod: 6, weeklySeasonPeriod: 6 },
    });

    expect(leakEval.observedValue).toBeLessThan(1024);
    expect(leakEval.predicted20MinValue).toBeGreaterThan(1024);
    expect(leakEval.predictedBreachIn20Min).toBe(true);

    // Sudden >3 sigma latency spike
    const latencySamples = Array.from({ length: 30 }, (_, m) => ({
      timestampMs: 1_700_000_000_000 + m * 60_000,
      value: m === 29 ? 480 : 42 + (m % 3),
    }));

    const latencyEval = service.evaluateGoldenSignal({
      signal: 'LATENCY',
      samples: latencySamples,
      config: { dailySeasonPeriod: 6, weeklySeasonPeriod: 6 },
    });

    expect(latencyEval.isAnomaly3Sigma).toBe(true);
    expect(latencyEval.zScore).toBeGreaterThan(3);

    const sent = await service.dispatchAnomalyWebhook(latencyEval, [
      'SLACK',
      'DISCORD',
      'PAGERDUTY',
    ]);
    expect(sent).toHaveLength(3);
    expect(sent.map((s) => s.channel)).toEqual(['SLACK', 'DISCORD', 'PAGERDUTY']);
  });
});
