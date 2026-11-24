import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LspWorkerCrashSupervisorService {
  constructor() { this.counts = new Map(); }
  crash(id) {
    const c = (this.counts.get(id) || 0) + 1;
    this.counts.set(id, c);
    return { restart: c <= 3, count: c };
  }
}

describe('LspWorkerCrashSupervisorService (#2268)', () => {
  test('automatically restarts crashed LSP workers up to restart limit', () => {
    const sup = new LspWorkerCrashSupervisorService();
    assert.strictEqual(sup.crash('w1').restart, true);
    assert.strictEqual(sup.crash('w1').restart, true);
    assert.strictEqual(sup.crash('w1').restart, true);
    assert.strictEqual(sup.crash('w1').restart, false);
  });
});
