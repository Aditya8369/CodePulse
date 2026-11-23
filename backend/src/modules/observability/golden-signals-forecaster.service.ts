import { Injectable, Logger } from '@nestjs/common';

export type GoldenSignalType = 'LATENCY' | 'TRAFFIC' | 'ERRORS' | 'SATURATION';
export type WebhookChannel = 'SLACK' | 'DISCORD' | 'PAGERDUTY';

export interface GoldenSignalSample {
  timestampMs: number;
  value: number;
}

export interface HoltWintersConfig {
  alpha?: number; // Level smoothing (0..1)
  beta?: number; // Trend smoothing (0..1)
  gamma?: number; // Seasonal smoothing (0..1)
  dailySeasonPeriod?: number; // Default 24 (hourly buckets) or 1440 (minute buckets)
  weeklySeasonPeriod?: number; // Default 168 (hourly) or 10080 (minute)
}

export interface SignalAnomalyEvaluation {
  signal: GoldenSignalType;
  observedValue: number;
  expectedSeasonalValue: number;
  lowerBound3Sigma: number;
  upperBound3Sigma: number;
  rollingStdDev: number;
  zScore: number;
  isAnomaly3Sigma: boolean;
  predicted20MinValue: number;
  predictedBreachIn20Min: boolean;
  reason: string | null;
}

export interface WebhookAlertPayload {
  channel: WebhookChannel;
  severity: 'WARNING' | 'CRITICAL';
  signal: GoldenSignalType;
  title: string;
  summary: string;
  observedValue: number;
  expectedValue: number;
  zScore: number;
  predicted20MinValue: number;
  timestampIso: string;
}

@Injectable()
export class GoldenSignalsForecasterService {
  private readonly logger = new Logger(GoldenSignalsForecasterService.name);
  private readonly dispatchedAlerts: WebhookAlertPayload[] = [];

  /**
   * Holt-Winters additive triple exponential smoothing incorporating both
   * daily and weekly seasonal indices plus organic trend adaptation.
   */
  forecastHoltWinters(
    series: number[],
    horizonSteps = 20,
    config: HoltWintersConfig = {},
  ): {
    fitted: number[];
    forecast: number[];
    residuals: number[];
    level: number;
    trend: number;
  } {
    const n = series.length;
    if (n === 0) {
      return { fitted: [], forecast: [], residuals: [], level: 0, trend: 0 };
    }
    if (n === 1) {
      return {
        fitted: [series[0]],
        forecast: Array(horizonSteps).fill(series[0]),
        residuals: [0],
        level: series[0],
        trend: 0,
      };
    }

    const alpha = config.alpha ?? 0.35;
    const beta = config.beta ?? 0.12;
    const gamma = config.gamma ?? 0.25;
    const dailyPeriod = Math.max(2, Math.min(config.dailySeasonPeriod ?? 24, Math.floor(n / 2) || 2));
    const weeklyPeriod = Math.max(
      dailyPeriod,
      Math.min(config.weeklySeasonPeriod ?? 168, Math.floor(n / 2) || dailyPeriod),
    );

    const dailySeason = new Array<number>(dailyPeriod).fill(0);
    const weeklySeason = new Array<number>(weeklyPeriod).fill(0);

    // Initialize seasonal offsets from first cycle if available
    const initWindow = Math.min(n, dailyPeriod);
    const initMean =
      series.slice(0, initWindow).reduce((acc, v) => acc + v, 0) / initWindow;
    for (let i = 0; i < initWindow; i++) {
      dailySeason[i % dailyPeriod] = (series[i] - initMean) * 0.7;
      weeklySeason[i % weeklyPeriod] = (series[i] - initMean) * 0.3;
    }

    let level = series[0];
    let trend = series[1] - series[0];

    const fitted: number[] = [];
    const residuals: number[] = [];

    for (let t = 0; t < n; t++) {
      const dIdx = t % dailyPeriod;
      const wIdx = t % weeklyPeriod;
      const seasonalSum = dailySeason[dIdx] + weeklySeason[wIdx];
      const prediction = level + trend + seasonalSum;

      fitted.push(prediction);
      const obs = series[t];
      residuals.push(obs - prediction);

      const prevLevel = level;
      level = alpha * (obs - seasonalSum) + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      const seasonalResidual = obs - level;
      dailySeason[dIdx] = gamma * (seasonalResidual * 0.7) + (1 - gamma) * dailySeason[dIdx];
      weeklySeason[wIdx] = gamma * (seasonalResidual * 0.3) + (1 - gamma) * weeklySeason[wIdx];
    }

    const forecast: number[] = [];
    for (let h = 1; h <= horizonSteps; h++) {
      const futureIdx = n + h - 1;
      const seasonalFuture =
        dailySeason[futureIdx % dailyPeriod] + weeklySeason[futureIdx % weeklyPeriod];
      forecast.push(level + h * trend + seasonalFuture);
    }

    return { fitted, forecast, residuals, level, trend };
  }

  /**
   * Evaluates a Golden Signal series against dynamic +/- 3 sigma seasonal confidence bounds
   * and predicts 20-minute pre-failure trajectory (latency creep or memory leak saturation).
   */
  evaluateGoldenSignal(params: {
    signal: GoldenSignalType;
    samples: GoldenSignalSample[];
    criticalCapacityThreshold?: number;
    horizonMinutes?: number;
    config?: HoltWintersConfig;
  }): SignalAnomalyEvaluation {
    const values = params.samples.map((s) => s.value);
    const horizon = params.horizonMinutes ?? 20;

    if (values.length < 3) {
      const latest = values[values.length - 1] ?? 0;
      return {
        signal: params.signal,
        observedValue: latest,
        expectedSeasonalValue: latest,
        lowerBound3Sigma: latest,
        upperBound3Sigma: latest,
        rollingStdDev: 0,
        zScore: 0,
        isAnomaly3Sigma: false,
        predicted20MinValue: latest,
        predictedBreachIn20Min: false,
        reason: null,
      };
    }

    // Fit Holt-Winters on baseline history up to N-1 so latest point is evaluated out-of-sample
    const history = values.slice(0, -1);
    const observedValue = values[values.length - 1];
    const hwHistory = this.forecastHoltWinters(history, 1, params.config);
    const expectedSeasonalValue = Number(hwHistory.forecast[0].toFixed(4));

    // Rolling residual standard deviation over recent window (up to 60 points)
    const recentResiduals = hwHistory.residuals.slice(-60);
    const meanRes =
      recentResiduals.reduce((acc, r) => acc + r, 0) / recentResiduals.length;
    const variance =
      recentResiduals.reduce((acc, r) => acc + (r - meanRes) ** 2, 0) /
      Math.max(1, recentResiduals.length - 1);
    const rollingStdDev = Number(Math.max(1e-3, Math.sqrt(variance)).toFixed(4));

    const zScore = Number(
      ((observedValue - expectedSeasonalValue) / rollingStdDev).toFixed(3),
    );
    const lowerBound3Sigma = Number(
      (expectedSeasonalValue - 3 * rollingStdDev).toFixed(4),
    );
    const upperBound3Sigma = Number(
      (expectedSeasonalValue + 3 * rollingStdDev).toFixed(4),
    );
    const isAnomaly3Sigma = Math.abs(zScore) > 3.0;

    // 20-minute predictive trajectory using full series including latest point
    const hwFull = this.forecastHoltWinters(values, horizon, params.config);
    const predicted20MinValue = Number(
      (hwFull.forecast[hwFull.forecast.length - 1] ?? observedValue).toFixed(4),
    );

    const predictedBreachIn20Min = Boolean(
      typeof params.criticalCapacityThreshold === 'number' &&
        predicted20MinValue >= params.criticalCapacityThreshold &&
        observedValue < params.criticalCapacityThreshold,
    );

    let reason: string | null = null;
    if (isAnomaly3Sigma) {
      reason = `${params.signal} deviated by ${zScore}σ from seasonal baseline (observed=${observedValue}, expected=${expectedSeasonalValue}, ±3σ=[${lowerBound3Sigma}, ${upperBound3Sigma}])`;
    } else if (predictedBreachIn20Min) {
      reason = `Predictive ${horizon}-min trajectory for ${params.signal} (${predicted20MinValue}) projected to breach capacity threshold (${params.criticalCapacityThreshold})`;
    }

    return {
      signal: params.signal,
      observedValue,
      expectedSeasonalValue,
      lowerBound3Sigma,
      upperBound3Sigma,
      rollingStdDev,
      zScore,
      isAnomaly3Sigma,
      predicted20MinValue,
      predictedBreachIn20Min,
      reason,
    };
  }

  /**
   * Benchmarks false-positive noise reduction vs static threshold alerting across
   * normal diurnal peak traffic/CPU cycles.
   */
  compareNoiseVsStaticThreshold(params: {
    signal: GoldenSignalType;
    samples: GoldenSignalSample[];
    staticThreshold: number;
    config?: HoltWintersConfig;
  }): {
    staticAlertCount: number;
    predictiveAlertCount: number;
    falsePositiveReductionPercent: number;
  } {
    let staticAlerts = 0;
    let predictiveAlerts = 0;

    for (let i = 10; i < params.samples.length; i++) {
      const slice = params.samples.slice(0, i + 1);
      const current = slice[slice.length - 1].value;
      if (current > params.staticThreshold) {
        staticAlerts += 1;
      }
      const evalRes = this.evaluateGoldenSignal({
        signal: params.signal,
        samples: slice,
        config: params.config,
      });
      if (evalRes.isAnomaly3Sigma) {
        predictiveAlerts += 1;
      }
    }

    const reduction =
      staticAlerts > 0
        ? Number(
            (
              Math.max(0, (staticAlerts - predictiveAlerts) / staticAlerts) * 100
            ).toFixed(1),
          )
        : 100;

    return {
      staticAlertCount: staticAlerts,
      predictiveAlertCount: predictiveAlerts,
      falsePositiveReductionPercent: reduction,
    };
  }

  /**
   * Dispatches intelligent webhook alerts to Slack, Discord, or PagerDuty
   * only when observed metric breaches > 3 sigma or 20-min pre-failure threshold.
   */
  async dispatchAnomalyWebhook(
    evaluation: SignalAnomalyEvaluation,
    channels: WebhookChannel[] = ['SLACK', 'DISCORD', 'PAGERDUTY'],
    webhookSender?: (payload: WebhookAlertPayload) => Promise<boolean>,
  ): Promise<WebhookAlertPayload[]> {
    if (!evaluation.isAnomaly3Sigma && !evaluation.predictedBreachIn20Min) {
      return [];
    }

    const sent: WebhookAlertPayload[] = [];
    for (const channel of channels) {
      const payload: WebhookAlertPayload = {
        channel,
        severity: evaluation.isAnomaly3Sigma ? 'CRITICAL' : 'WARNING',
        signal: evaluation.signal,
        title: `[CodePulse SRE] Predictive Anomaly on ${evaluation.signal}`,
        summary: evaluation.reason ?? 'Golden signal threshold anomaly detected',
        observedValue: evaluation.observedValue,
        expectedValue: evaluation.expectedSeasonalValue,
        zScore: evaluation.zScore,
        predicted20MinValue: evaluation.predicted20MinValue,
        timestampIso: new Date().toISOString(),
      };

      if (webhookSender) {
        await webhookSender(payload);
      }
      this.dispatchedAlerts.push(payload);
      sent.push(payload);
      this.logger.warn(`Dispatched ${channel} anomaly webhook: ${payload.summary}`);
    }

    return sent;
  }

  getDispatchedAlerts(): WebhookAlertPayload[] {
    return [...this.dispatchedAlerts];
  }
}
