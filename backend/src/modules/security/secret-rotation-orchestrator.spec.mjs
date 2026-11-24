import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SecretRotationOrchestratorService {
  constructor() { this.keys = [{ v: 1, s: 'k1', status: 'ACTIVE' }]; }
  rotate(s) {
    this.keys.forEach(k => { if (k.status === 'ACTIVE') k.status = 'PREV'; });
    this.keys.push({ v: this.keys.length + 1, s, status: 'ACTIVE' });
  }
  valid() { return this.keys.filter(k => k.status !== 'REVOKED').map(k => k.s); }
}

describe('SecretRotationOrchestratorService (#2177)', () => {
  test('supports dual-key verification during secret rotation window', () => {
    const orch = new SecretRotationOrchestratorService();
    orch.rotate('k2');
    const valid = orch.valid();
    assert.strictEqual(valid.includes('k1'), true);
    assert.strictEqual(valid.includes('k2'), true);
  });
});
