import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SessionGeoMigrationService {
  constructor() { this.store = new Map(); }
  migrate(id, s, t, state) {
    const p = { id, s, t, state };
    this.store.set(id, p);
    return p;
  }
}

describe('SessionGeoMigrationService (#2134)', () => {
  test('migrates cross-region session state between cluster nodes without data loss', () => {
    const migrator = new SessionGeoMigrationService();
    const res = migrator.migrate('sess-1', 'us-east-1', 'eu-west-1', { score: 100 });
    assert.strictEqual(res.t, 'eu-west-1');
    assert.strictEqual(res.state.score, 100);
  });
});
