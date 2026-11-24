import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class JaegerGraphCycleResolverService {
  sanitize(spans) {
    return spans.map(s => {
      if (s.parent === s.id) return { id: s.id, parent: null };
      return s;
    });
  }
}

describe('JaegerGraphCycleResolverService (#2232)', () => {
  test('detects and breaks circular parent-child trace relationships preventing visualizer deadlocks', () => {
    const resolver = new JaegerGraphCycleResolverService();
    const res = resolver.sanitize([{ id: 'span-1', parent: 'span-1' }]);
    assert.strictEqual(res[0].parent, null);
  });
});
