import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CrdtDocumentSynchronizerService {
  constructor() { this.s = new Map(); }
  set(k, val, node, ts = Date.now()) {
    const e = { k, val, node, ts };
    this.s.set(k, e);
    return e;
  }
  merge(rem) {
    const loc = this.s.get(rem.k);
    if (!loc || rem.ts > loc.ts || (rem.ts === loc.ts && rem.node > loc.node)) {
      this.s.set(rem.k, rem);
      return true;
    }
    return false;
  }
  get(k) { return this.s.get(k)?.val; }
}

describe('CrdtDocumentSynchronizerService (#2710)', () => {
  test('converges distributed state deterministically via Last-Write-Wins CRDT semantics', () => {
    const crdtA = new CrdtDocumentSynchronizerService();
    crdtA.set('doc_title', 'Version 1', 'node-1', 1000);

    const remoteUpdate = { k: 'doc_title', val: 'Version 2', node: 'node-2', ts: 1005 };
    const accepted = crdtA.merge(remoteUpdate);
    assert.strictEqual(accepted, true);
    assert.strictEqual(crdtA.get('doc_title'), 'Version 2');

    // Reject older remote state
    const staleUpdate = { k: 'doc_title', val: 'Ancient Version', node: 'node-3', ts: 990 };
    assert.strictEqual(crdtA.merge(staleUpdate), false);
    assert.strictEqual(crdtA.get('doc_title'), 'Version 2');
  });
});
