import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DORAMetricsPipelineService {
  computeMTTR(list) {
    if (!list.length) return 0;
    const tot = list.reduce((s, i) => s + (i.resolvedAt - i.startedAt), 0);
    return Math.floor(tot / list.length / 1000 / 60);
  }
  computeDeploymentFrequency(c, d) { return Number((c / d).toFixed(2)); }
}

describe('DORAMetricsPipelineService (Issue #1907)', () => {
  it('should compute DORA metrics including MTTR and deployment frequency', () => {
    const dora = new DORAMetricsPipelineService();
    const incidents = [
      { incidentId: '1', startedAt: 0, resolvedAt: 120000 },  // 2 mins
      { incidentId: '2', startedAt: 0, resolvedAt: 240000 }   // 4 mins
    ];

    assert.equal(dora.computeMTTR(incidents), 3); // 3 minutes avg
    assert.equal(dora.computeDeploymentFrequency(14, 7), 2.0); // 2 deploys/day
  });
});
