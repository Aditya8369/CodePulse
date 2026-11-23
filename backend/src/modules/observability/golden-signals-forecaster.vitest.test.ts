import { describe, it, expect } from 'vitest';
import { GoldenSignalsForecasterService } from './golden-signals-forecaster.service';

describe('GoldenSignalsForecasterService Statistical Forecasting (Vitest)', () => {
  it('adapts to organic traffic growth without false >3 sigma alerts while catching true spikes', () => {
    const forecaster = new GoldenSignalsForecasterService();

    // Organic steady traffic growth from 100 rps -> 220 rps
    const organicGrowth = Array.from({ length: 40 }, (_, i) => ({
      timestampMs: i * 60_000,
      value: 100 + i * 3 + Math.sin(i / 3) * 2,
    }));

    const normalEval = forecaster.evaluateGoldenSignal({
      signal: 'TRAFFIC',
      samples: organicGrowth,
      config: { dailySeasonPeriod: 6, weeklySeasonPeriod: 6 },
    });
    expect(normalEval.isAnomaly3Sigma).toBe(false);

    // Sudden 5xx error spike > 3 sigma
    const errorSpike = [
      ...Array.from({ length: 25 }, (_, i) => ({ timestampMs: i * 60_000, value: 0.1 + (i % 2) * 0.02 })),
      { timestampMs: 25 * 60_000, value: 4.8 },
    ];
    const errEval = forecaster.evaluateGoldenSignal({
      signal: 'ERRORS',
      samples: errorSpike,
      config: { dailySeasonPeriod: 4, weeklySeasonPeriod: 4 },
    });
    expect(errEval.isAnomaly3Sigma).toBe(true);
    expect(errEval.zScore).toBeGreaterThan(3);
  });
});
