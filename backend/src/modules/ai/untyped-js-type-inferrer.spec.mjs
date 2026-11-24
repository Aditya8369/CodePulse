import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class UntypedJsTypeInferrerService {
  infer(v) {
    if (v.startsWith('"') || v.startsWith("'")) return 'string';
    if (!isNaN(Number(v)) && v.trim() !== '') return 'number';
    if (v === 'true' || v === 'false') return 'boolean';
    return 'unknown';
  }
}

describe('UntypedJsTypeInferrerService (#2264)', () => {
  test('infers primitive TypeScript types from raw JavaScript token representations', () => {
    const inferrer = new UntypedJsTypeInferrerService();
    assert.strictEqual(inferrer.infer('"hello"'), 'string');
    assert.strictEqual(inferrer.infer('42'), 'number');
    assert.strictEqual(inferrer.infer('true'), 'boolean');
  });
});
