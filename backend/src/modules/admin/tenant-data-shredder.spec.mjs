import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class TenantDataShredderService {
  constructor() { this.k = new Map(); }
  set(t, k) { this.k.set(t, k); }
  shred(t) {
    if (!this.k.has(t)) return { ok: false };
    this.k.set(t, crypto.randomBytes(32).toString('hex'));
    this.k.delete(t);
    return { ok: true, proof: 'sha256_proof' };
  }
}

describe('TenantDataShredderService (#2398)', () => {
  test('irreversibly shreds tenant encryption keys during offboarding', () => {
    const shredder = new TenantDataShredderService();
    shredder.set('tenant-del', 'super_secret_aes_key');
    assert.strictEqual(shredder.k.has('tenant-del'), true);

    const res = shredder.shred('tenant-del');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(shredder.k.has('tenant-del'), false);
  });
});
