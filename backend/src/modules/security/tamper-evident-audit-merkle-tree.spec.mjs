import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class TamperEvidentAuditMerkleTreeService {
  root(leaves) {
    let c = leaves.map(l => crypto.createHash('sha256').update(l).digest('hex'));
    while (c.length > 1) {
      const n = [];
      for (let i = 0; i < c.length; i += 2) {
        n.push(crypto.createHash('sha256').update(c[i] + (c[i+1] || c[i])).digest('hex'));
      }
      c = n;
    }
    return c[0];
  }
}

describe('TamperEvidentAuditMerkleTreeService (#2192)', () => {
  test('computes cryptographic Merkle tree root over log batches ensuring audit immutability', () => {
    const tree = new TamperEvidentAuditMerkleTreeService();
    const r1 = tree.root(['audit-1', 'audit-2', 'audit-3']);
    const r2 = tree.root(['audit-1', 'audit-2', 'audit-3']);
    const rTampered = tree.root(['audit-1', 'audit-tampered', 'audit-3']);

    assert.strictEqual(r1, r2);
    assert.notStrictEqual(r1, rTampered);
  });
});
