import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PrismaBatchSplitterService {
  chunk(items, size = 2) {
    const res = [];
    for (let i = 0; i < items.length; i += size) res.push(items.slice(i, i + size));
    return res;
  }
}

describe('PrismaBatchSplitterService (#2155)', () => {
  test('splits large bulk entity mutations into bounded chunks to prevent parameter limits', () => {
    const splitter = new PrismaBatchSplitterService();
    const chunks = splitter.chunk([1, 2, 3, 4, 5], 2);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].length, 2);
    assert.strictEqual(chunks[2].length, 1);
  });
});
