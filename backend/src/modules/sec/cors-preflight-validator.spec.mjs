import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CORSPreflightValidatorService {
  constructor() {
    this.patterns = [
      /^https:\/\/([a-zA-Z0-9-]+\.)?codepulse\.dev$/,
      /^http:\/\/localhost:(3000|5173)$/
    ];
  }
  isOriginAllowed(origin) {
    if (!origin) return false;
    return this.patterns.some(p => p.test(origin));
  }
  validatePreflight(origin, method) {
    if (!this.isOriginAllowed(origin)) return { allowed: false, headers: {} };
    return {
      allowed: true,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    };
  }
}

describe('CORSPreflightValidatorService (Issue #1863)', () => {
  it('should validate allowed CORS origins and reject rogue domains', () => {
    const cors = new CORSPreflightValidatorService();
    assert.equal(cors.isOriginAllowed('https://app.codepulse.dev'), true);
    assert.equal(cors.isOriginAllowed('http://localhost:3000'), true);
    assert.equal(cors.isOriginAllowed('https://attacker-codepulse.dev.fake.com'), false);
    assert.equal(cors.validatePreflight('https://app.codepulse.dev', 'OPTIONS').allowed, true);
  });
});
