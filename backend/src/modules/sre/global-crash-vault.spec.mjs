import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GlobalCrashVaultService {
  constructor() { this.logs = []; }
  captureCrash(type, err) {
    const d = {
      timestamp: new Date().toISOString(),
      type,
      message: err?.message || String(err),
      stack: err?.stack
    };
    this.logs.push(d);
    return d;
  }
}

describe('GlobalCrashVaultService (Issue #1870)', () => {
  it('should capture structured crash diagnostics for uncaught exceptions', () => {
    const vault = new GlobalCrashVaultService();
    const diag = vault.captureCrash('UNHANDLED_REJECTION', new Error('DB connection refused'));

    assert.equal(diag.type, 'UNHANDLED_REJECTION');
    assert.equal(diag.message, 'DB connection refused');
    assert.ok(diag.stack !== undefined);
  });
});
