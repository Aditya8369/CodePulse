import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CryptographicReplayNonceVaultService {
  constructor() { this.vault = new Map(); }
  check(n, now) {
    if (this.vault.has(n)) return false;
    this.vault.set(n, now);
    return true;
  }
}

describe('CryptographicReplayNonceVaultService (#2188)', () => {
  test('rejects duplicated nonces and permits unique nonces within TTL window', () => {
    const vault = new CryptographicReplayNonceVaultService();
    assert.strictEqual(vault.check('nonce-1', 1000), true);
    assert.strictEqual(vault.check('nonce-1', 1050), false);
    assert.strictEqual(vault.check('nonce-2', 1050), true);
  });
});
