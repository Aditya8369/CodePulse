import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DisputeAdjudicationSnapshotsService {
  adjudicate(server, clients) {
    if (clients.length === 0) return { ruling: 'INDETERMINATE', pct: 0 };
    const matches = clients.filter(c => c === server).length;
    const pct = Math.round((matches / clients.length) * 100);
    return {
      ruling: pct >= 66 ? 'CONFIRMED_SERVER_MATCH' : 'CLIENT_TAMPER_DETECTED',
      pct
    };
  }
}

describe('DisputeAdjudicationSnapshotsService (#2322)', () => {
  test('reconciles multi-angle client state hashes against authoritative server state', () => {
    const adj = new DisputeAdjudicationSnapshotsService();
    const good = adj.adjudicate('hash123', ['hash123', 'hash123', 'hash999']);
    assert.strictEqual(good.ruling, 'CONFIRMED_SERVER_MATCH');
    assert.strictEqual(good.pct, 67);

    const bad = adj.adjudicate('hash123', ['hash999', 'hash888', 'hash777']);
    assert.strictEqual(bad.ruling, 'CLIENT_TAMPER_DETECTED');
    assert.strictEqual(bad.pct, 0);
  });
});
