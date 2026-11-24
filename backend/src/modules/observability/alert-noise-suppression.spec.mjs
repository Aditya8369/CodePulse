import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AlertNoiseSuppressionService {
  constructor(window = 1000) { this.w = window; this.c = new Map(); }
  ingestAlert(a) {
    const cid = a.source + ':' + a.fingerprint;
    const ex = (this.c.get(cid) || []).filter(e => a.timestamp - e.timestamp <= this.w);
    ex.push(a);
    this.c.set(cid, ex);
    return { isSuppressed: ex.length > 1, clusterId: cid };
  }
}

describe('AlertNoiseSuppressionService (Issue #1895)', () => {
  it('should suppress correlated storming alerts arriving within the deduplication window', () => {
    const suppressor = new AlertNoiseSuppressionService(5000);
    const a1 = { id: '1', source: 'db', fingerprint: 'deadlock-error', timestamp: 1000 };
    const a2 = { id: '2', source: 'db', fingerprint: 'deadlock-error', timestamp: 2000 };
    const a3 = { id: '3', source: 'redis', fingerprint: 'timeout-error', timestamp: 2000 };

    assert.equal(suppressor.ingestAlert(a1).isSuppressed, false, 'First alert must notify');
    assert.equal(suppressor.ingestAlert(a2).isSuppressed, true, 'Duplicate alert must be suppressed');
    assert.equal(suppressor.ingestAlert(a3).isSuppressed, false, 'Different alert source must notify');
  });
});
