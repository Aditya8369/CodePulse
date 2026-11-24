import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class NetworkEgressAnalyzerService {
  constructor() { this.m = new Map(); }
  recordEgress(s, t, b) {
    const k = s + '->' + t;
    this.m.set(k, (this.m.get(k) || 0) + b);
  }
  isSpiking(s, t, thresh) { return (this.m.get(s + '->' + t) || 0) > thresh; }
}

describe('NetworkEgressAnalyzerService (Issue #1913)', () => {
  it('should track cross-region egress traffic volume and flag cost threshold breaches', () => {
    const analyzer = new NetworkEgressAnalyzerService();
    analyzer.recordEgress('us-east-1', 'eu-west-1', 5000);
    analyzer.recordEgress('us-east-1', 'eu-west-1', 6000);

    assert.equal(analyzer.isSpiking('us-east-1', 'eu-west-1', 10000), true);
    assert.equal(analyzer.isSpiking('us-east-1', 'ap-south-1', 1000), false);
  });
});
