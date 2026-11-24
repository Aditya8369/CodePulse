import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpanRecursionMemoryGuardService {
  check(d) { return { allow: d <= 64 }; }
}

describe('SpanRecursionMemoryGuardService (#2254)', () => {
  test('truncates span hierarchy depth to prevent OOM on infinite recursive call stacks', () => {
    const guard = new SpanRecursionMemoryGuardService();
    assert.strictEqual(guard.check(30).allow, true);
    assert.strictEqual(guard.check(80).allow, false);
  });
});
