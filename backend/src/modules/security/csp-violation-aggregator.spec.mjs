import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CspViolationAggregatorService {
  constructor() { this.store = new Map(); }
  record(directive, uri) {
    const k = directive + ':' + uri;
    const c = (this.store.get(k) || 0) + 1;
    this.store.set(k, c);
    return c;
  }
}

describe('CspViolationAggregatorService (#2174)', () => {
  test('coalesces duplicate CSP violation reports into frequency buckets', () => {
    const agg = new CspViolationAggregatorService();
    assert.strictEqual(agg.record('script-src', 'https://evil.cdn'), 1);
    assert.strictEqual(agg.record('script-src', 'https://evil.cdn'), 2);
  });
});
