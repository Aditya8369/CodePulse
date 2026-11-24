import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SandboxedTestValidationHarnessService {
  check(code) {
    try { new Function(code); return { ok: true }; }
    catch (e) { return { ok: false, err: e.message }; }
  }
}

describe('SandboxedTestValidationHarnessService (#2278)', () => {
  test('validates syntax sanity of generated AI code snippets prior to emission', () => {
    const harness = new SandboxedTestValidationHarnessService();
    assert.strictEqual(harness.check('const a = 10;').ok, true);
    assert.strictEqual(harness.check('const a = ;').ok, false);
  });
});
