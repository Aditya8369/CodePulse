import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class HstsSecurityHeaderEnforcerService {
  getHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    };
  }
}

describe('HstsSecurityHeaderEnforcerService (#2172)', () => {
  test('generates production-grade HSTS and anti-clickjacking security headers', () => {
    const enforcer = new HstsSecurityHeaderEnforcerService();
    const headers = enforcer.getHeaders();
    assert.strictEqual(headers['Strict-Transport-Security'].includes('max-age=63072000'), true);
    assert.strictEqual(headers['X-Frame-Options'], 'DENY');
  });
});
