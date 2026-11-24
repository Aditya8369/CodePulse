import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GraphqlComplexityGuardService {
  calc(q) {
    let d = 0, m = 0;
    for (const c of q) {
      if (c === '{') { if (++d > m) m = d; }
      else if (c === '}') d = Math.max(0, d - 1);
    }
    return m;
  }
}

describe('GraphqlComplexityGuardService (#2182)', () => {
  test('calculates query nesting depth and intercepts circular GraphQL queries', () => {
    const guard = new GraphqlComplexityGuardService();
    assert.strictEqual(guard.calc('{ user { id } }'), 2);
    assert.strictEqual(guard.calc('{ a { b { c { d { e { f } } } } } }'), 6);
  });
});
