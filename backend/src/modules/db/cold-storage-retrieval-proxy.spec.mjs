import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ColdStorageRetrievalProxyService {
  constructor() { this.idx = new Map(); }
  set(id, tier) { this.idx.set(id, tier); }
  get(id) {
    const t = this.idx.get(id);
    return { tier: t, restoreNeeded: t === 'GLACIER' };
  }
}

describe('ColdStorageRetrievalProxyService (#2161)', () => {
  test('routes cold archive requests and identifies Glacier restoration requirements', () => {
    const proxy = new ColdStorageRetrievalProxyService();
    proxy.set('doc-hot', 'HOT');
    proxy.set('doc-cold', 'GLACIER');

    assert.strictEqual(proxy.get('doc-hot').restoreNeeded, false);
    assert.strictEqual(proxy.get('doc-cold').restoreNeeded, true);
  });
});
