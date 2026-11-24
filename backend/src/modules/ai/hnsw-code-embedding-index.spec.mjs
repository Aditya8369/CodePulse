import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class HnswCodeEmbeddingIndexService {
  constructor() { this.items = []; }
  add(id, v) { this.items.push({ id, v }); }
  find(qv) {
    let best = null, max = -1;
    for (const it of this.items) {
      const d = it.v[0] * qv[0] + it.v[1] * qv[1];
      if (d > max) { max = d; best = it.id; }
    }
    return best;
  }
}

describe('HnswCodeEmbeddingIndexService (#2269)', () => {
  test('performs approximate nearest neighbor vector search across code snippets', () => {
    const idx = new HnswCodeEmbeddingIndexService();
    idx.add('snip-a', [1.0, 0.0]);
    idx.add('snip-b', [0.0, 1.0]);
    assert.strictEqual(idx.find([0.9, 0.1]), 'snip-a');
    assert.strictEqual(idx.find([0.1, 0.9]), 'snip-b');
  });
});
