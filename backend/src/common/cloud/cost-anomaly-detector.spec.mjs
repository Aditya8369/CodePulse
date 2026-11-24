import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RealtimeCostAnomalyDetectorService {
  constructor(windowSize = 24, sigmaThreshold = 3.0) {
    this.windowSize = windowSize;
    this.sigmaThreshold = sigmaThreshold;
    this.history = new Map();
  }
  recordReading(reading) {
    const h = this.history.get(reading.service) || [];
    h.push(reading.costPerHourUsd);
    if (h.length > this.windowSize) h.shift();
    this.history.set(reading.service, h);

    if (h.length < 5) {
      return { service: reading.service, isAnomaly: false };
    }
    const mean = h.reduce((a, b) => a + b, 0) / h.length;
    const variance = h.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / h.length;
    const stdDev = Math.sqrt(variance) || 0.001;
    const zScore = (reading.costPerHourUsd - mean) / stdDev;
    const isAnomaly = zScore >= this.sigmaThreshold && reading.costPerHourUsd > mean * 1.5;
    return { service: reading.service, currentCostPerHour: reading.costPerHourUsd, expectedCostPerHour: mean, deviationSigma: zScore, isAnomaly };
  }
}

describe('RealtimeCostAnomalyDetectorService (Issue #1437)', () => {
  it('should flag runaway spend spikes exceeding 3-sigma deviation', () => {
    const detector = new RealtimeCostAnomalyDetectorService(24, 3.0);

    // Normal baseline: ~ $5.00/hour
    for (let i = 0; i < 20; i++) {
      detector.recordReading({ timestamp: Date.now(), service: 'openai-gateway', costPerHourUsd: 5.0 + (Math.random() * 0.2) });
    }

    // Runaway loop spike: $150.00/hour
    const alert = detector.recordReading({ timestamp: Date.now(), service: 'openai-gateway', costPerHourUsd: 150.0 });
    assert.equal(alert.isAnomaly, true);
    assert.ok(alert.deviationSigma >= 3.0);
  });
});
