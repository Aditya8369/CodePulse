import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SlowQueryCorrelatorService {
  formatLog(c) {
    return JSON.stringify({ type: 'SLOW_QUERY', endpoint: c.endpoint, userId: c.userId || 'anonymous', durationMs: c.durationMs });
  }
}

describe('SlowQueryCorrelatorService (Issue #1914)', () => {
  it('should annotate slow database queries with user ID and API route context', () => {
    const correlator = new SlowQueryCorrelatorService();
    const log = correlator.formatLog({
      userId: 'user-777',
      endpoint: 'GET /api/tournaments',
      durationMs: 750,
      sqlQuery: 'SELECT * FROM tournaments WHERE active = true'
    });

    const parsed = JSON.parse(log);
    assert.equal(parsed.userId, 'user-777');
    assert.equal(parsed.endpoint, 'GET /api/tournaments');
  });
});
