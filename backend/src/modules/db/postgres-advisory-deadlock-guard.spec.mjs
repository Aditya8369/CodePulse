import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PostgresAdvisoryDeadlockGuardService {
  constructor() { this.locks = new Map(); }
  acquire(key, timeout = 1000, now = Date.now()) {
    const ex = this.locks.get(key);
    if (ex && (now - ex.at <= ex.timeout)) return false;
    this.locks.set(key, { at: now, timeout });
    return true;
  }
}

describe('PostgresAdvisoryDeadlockGuardService (#2139)', () => {
  test('breaks stale advisory locks after timeout expiration to avoid permanent transaction deadlocks', () => {
    const guard = new PostgresAdvisoryDeadlockGuardService();
    const t0 = 1000;
    assert.strictEqual(guard.acquire(42, 500, t0), true);
    assert.strictEqual(guard.acquire(42, 500, t0 + 200), false);
    assert.strictEqual(guard.acquire(42, 500, t0 + 600), true); // Lock expired and acquired
  });
});
