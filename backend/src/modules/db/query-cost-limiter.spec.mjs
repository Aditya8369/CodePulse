import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class QueryCostLimiterService {
  constructor(max = 1000) { this.max = max; }
  estimateCost(sql) {
    let c = 10;
    const l = sql.toLowerCase();
    if (l.includes('cross join')) c += 800;
    if (l.includes('join')) c += 100;
    if (l.includes('order by') && !l.includes('limit')) c += 300;
    return c;
  }
  shouldAllow(sql) {
    const c = this.estimateCost(sql);
    return { allowed: c <= this.max, estimatedCost: c };
  }
}

describe('QueryCostLimiterService (Issue #1824)', () => {
  it('should intercept unindexed or cross-joined queries exceeding execution budget', () => {
    const limiter = new QueryCostLimiterService(500);
    assert.equal(limiter.shouldAllow('SELECT id FROM users LIMIT 10').allowed, true);
    assert.equal(limiter.shouldAllow('SELECT * FROM a CROSS JOIN b').allowed, false);
  });
});
