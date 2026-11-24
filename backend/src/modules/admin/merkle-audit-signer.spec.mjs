import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class MerkleAuditSignerService {
  root(entries) {
    if (!entries.length) return '';
    let h = entries.map(e => crypto.createHash('sha256').update(e).digest('hex'));
    while (h.length > 1) {
      const next = [];
      for (let i = 0; i < h.length; i += 2) {
        if (i + 1 < h.length) {
          next.push(crypto.createHash('sha256').update(h[i] + h[i + 1]).digest('hex'));
        } else {
          next.push(h[i]);
        }
      }
      h = next;
    }
    return h[0];
  }
}

describe('MerkleAuditSignerService (#2378)', () => {
  test('computes deterministic cryptographic Merkle root for audit log batches', () => {
    const signer = new MerkleAuditSignerService();
    const logs = ['audit_entry_1', 'audit_entry_2', 'audit_entry_3'];
    const r1 = signer.root(logs);
    const r2 = signer.root(logs);
    assert.strictEqual(r1, r2);
    assert.strictEqual(typeof r1, 'string');
    assert.strictEqual(r1.length, 64);
  });
});
