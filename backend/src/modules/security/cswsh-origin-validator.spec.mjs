import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CswshOriginValidatorService {
  constructor() { this.allowed = new Set(['https://codepulse.io']); }
  verify(origin) {
    if (!origin) return false;
    return this.allowed.has(origin);
  }
}

describe('CswshOriginValidatorService (#2185)', () => {
  test('rejects cross-site WebSocket handshake origins mitigating CSWSH attacks', () => {
    const validator = new CswshOriginValidatorService();
    assert.strictEqual(validator.verify('https://codepulse.io'), true);
    assert.strictEqual(validator.verify('https://attacker.site'), false);
    assert.strictEqual(validator.verify(undefined), false);
  });
});
