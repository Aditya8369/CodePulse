import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MonacoSnippetTelemetryService {
  constructor() { this.m = new Map(); }
  rec(k) { this.m.set(k, (this.m.get(k) || 0) + 1); }
  get(k) { return this.m.get(k) || 0; }
}

describe('MonacoSnippetTelemetryService (#2274)', () => {
  test('tracks code snippet autocompletion acceptance frequency and popularity', () => {
    const telem = new MonacoSnippetTelemetryService();
    telem.rec('for-loop');
    telem.rec('for-loop');
    assert.strictEqual(telem.get('for-loop'), 2);
    assert.strictEqual(telem.get('while-loop'), 0);
  });
});
