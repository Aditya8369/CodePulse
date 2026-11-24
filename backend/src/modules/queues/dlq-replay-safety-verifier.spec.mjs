import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DlqReplaySafetyVerifierService {
  verify(p, req) {
    const missing = req.filter(f => p[f] === undefined || p[f] === null);
    return { isSafe: missing.length === 0, missing };
  }
}

describe('DlqReplaySafetyVerifierService (#2309)', () => {
  test('validates payload schema before DLQ redrive to prevent re-crashing workers', () => {
    const verifier = new DlqReplaySafetyVerifierService();
    const good = verifier.verify({ id: 1, email: 'test@example.com' }, ['id', 'email']);
    assert.strictEqual(good.isSafe, true);

    const bad = verifier.verify({ id: 1 }, ['id', 'email']);
    assert.strictEqual(bad.isSafe, false);
    assert.deepStrictEqual(bad.missing, ['email']);
  });
});
