import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DbscanAlertClusteringEngineService {
  cluster(alerts) {
    const m = new Map();
    for (const a of alerts) {
      if (!m.has(a.sub)) m.set(a.sub, []);
      m.get(a.sub).push(a.id);
    }
    return m;
  }
}

describe('DbscanAlertClusteringEngineService (#2230)', () => {
  test('clusters correlated alerts to suppress alert storm notification noise', () => {
    const engine = new DbscanAlertClusteringEngineService();
    const alerts = [
      { id: 'a1', sub: 'db' },
      { id: 'a2', sub: 'db' },
      { id: 'a3', sub: 'redis' },
    ];
    const grouped = engine.cluster(alerts);
    assert.strictEqual(grouped.get('db').length, 2);
    assert.strictEqual(grouped.get('redis').length, 1);
  });
});
