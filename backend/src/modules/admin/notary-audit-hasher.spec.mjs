import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class NotaryAuditHasherService {
  constructor() { this.last = 'GENESIS'; }
  create(payload, ts = 1000) {
    const eHash = crypto.createHash('sha256').update(payload).digest('hex');
    const digest = crypto.createHash('sha256').update(`${this.last}:${eHash}:${ts}`).digest('hex');
    const r = { eHash, prev: this.last, ts, digest };
    this.last = digest;
    return r;
  }
}

describe('NotaryAuditHasherService (#2387)', () => {
  test('creates linked cryptographic notary receipts preventing log tampering', () => {
    const notary = new NotaryAuditHasherService();
    const r1 = notary.create('admin_login', 1000);
    assert.strictEqual(r1.prev, 'GENESIS');

    const r2 = notary.create('role_assigned', 1005);
    assert.strictEqual(r2.prev, r1.digest);
  });
});
