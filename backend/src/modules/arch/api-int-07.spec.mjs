import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KeysetPaginationEngineService } from './api-int-07.service.ts';

describe('KeysetPaginationEngineService (API-INT-07)', () => {
  it('paginates high-cardinality datasets stably without offset drift', () => {
    const engine = new KeysetPaginationEngineService();
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

    const page1 = engine.paginate(data, undefined, 2);
    assert.deepStrictEqual(page1.items.map(i => i.id), [1, 2]);
    assert.strictEqual(page1.nextCursor, 2);

    const page2 = engine.paginate(data, page1.nextCursor, 2);
    assert.deepStrictEqual(page2.items.map(i => i.id), [3, 4]);
  });
});
