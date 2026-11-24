import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class HighCardinalityIndexingService {
  constructor() { this.idx = new Map(); }
  indexSeries(id, labels) {
    for (const [k, v] of Object.entries(labels)) {
      const tok = k + '=' + v;
      if (!this.idx.has(tok)) this.idx.set(tok, new Set());
      this.idx.get(tok).add(id);
    }
  }
  query(labels) {
    let cur = null;
    for (const [k, v] of Object.entries(labels)) {
      const match = this.idx.get(k + '=' + v) || new Set();
      if (!cur) cur = new Set(match);
      else cur = new Set([...cur].filter(id => match.has(id)));
    }
    return cur ? Array.from(cur) : [];
  }
}

describe('HighCardinalityIndexingService (Issue #1894)', () => {
  it('should index high-cardinality metric labels and perform rapid set intersections', () => {
    const indexer = new HighCardinalityIndexingService();
    indexer.indexSeries(1, { app: 'codepulse', env: 'prod', region: 'us-east' });
    indexer.indexSeries(2, { app: 'codepulse', env: 'dev', region: 'us-east' });
    indexer.indexSeries(3, { app: 'codepulse', env: 'prod', region: 'eu-west' });

    const prodUsEast = indexer.query({ env: 'prod', region: 'us-east' });
    assert.deepEqual(prodUsEast, [1]);

    const allCodePulse = indexer.query({ app: 'codepulse' });
    assert.deepEqual(allCodePulse, [1, 2, 3]);
  });
});
