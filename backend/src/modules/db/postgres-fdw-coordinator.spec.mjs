import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PostgresFDWCoordinatorService {
  constructor(th = 3) { this.th = th; this.fails = new Map(); }
  canQuery(s) { return (this.fails.get(s) || 0) < this.th; }
  recordFailure(s) { this.fails.set(s, (this.fails.get(s) || 0) + 1); }
  reset(s) { this.fails.delete(s); }
}

describe('PostgresFDWCoordinatorService (Issue #1828)', () => {
  it('should trip circuit breaker when remote foreign server exceeds failure threshold', () => {
    const fdw = new PostgresFDWCoordinatorService(2);
    assert.equal(fdw.canQuery('analytics_fdw'), true);
    fdw.recordFailure('analytics_fdw');
    assert.equal(fdw.canQuery('analytics_fdw'), true);
    fdw.recordFailure('analytics_fdw');
    assert.equal(fdw.canQuery('analytics_fdw'), false, 'Should trip breaker on 2nd failure');
    fdw.reset('analytics_fdw');
    assert.equal(fdw.canQuery('analytics_fdw'), true);
  });
});
