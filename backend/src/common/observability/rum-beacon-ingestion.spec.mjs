import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RumBeaconIngestionService {
  constructor() {
    this.beacons = [];
  }
  ingest(b) {
    if (Array.isArray(b)) this.beacons.push(...b);
    else this.beacons.push(b);
  }
  calculateQuantiles(metric) {
    if (this.beacons.length === 0) return { count: 0, p50: 0, p75: 0, p95: 0, p99: 0 };
    const values = this.beacons.map(b => b[metric]).sort((a, b) => a - b);
    return {
      count: values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p75: values[Math.floor(values.length * 0.75)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }
  detectPerformanceDegradations() {
    const lcp75 = this.calculateQuantiles('lcp').p75;
    const reasons = [];
    if (lcp75 > 2500) reasons.push('LCP slow');
    return { hasDegradation: reasons.length > 0, reasons };
  }
}

describe('RumBeaconIngestionService (Issue #1472)', () => {
  it('should ingest beacons and calculate core web vitals quantiles accurately', () => {
    const rum = new RumBeaconIngestionService();
    for (let i = 1; i <= 100; i++) {
      rum.ingest({
        sessionId: 's-' + i,
        url: '/battle/live',
        browser: 'chrome',
        country: 'US',
        connectionType: '4g',
        lcp: i * 20,
        fid: i,
        cls: i * 0.001,
        inp: i * 2,
        ttfb: i * 5
      });
    }

    const lcpQuantiles = rum.calculateQuantiles('lcp');
    assert.equal(lcpQuantiles.count, 100);
    assert.equal(lcpQuantiles.p50, 1020);
    assert.equal(lcpQuantiles.p75, 1520);
  });

  it('should detect performance degradations when p75 exceeds threshold', () => {
    const rum = new RumBeaconIngestionService();
    rum.ingest([
      { lcp: 3000, fid: 10, cls: 0.01, inp: 50, ttfb: 100 },
      { lcp: 3500, fid: 20, cls: 0.02, inp: 60, ttfb: 120 }
    ]);
    const deg = rum.detectPerformanceDegradations();
    assert.equal(deg.hasDegradation, true);
  });
});
