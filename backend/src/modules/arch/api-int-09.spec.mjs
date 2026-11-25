import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DataloaderBatchingEngineService } from './api-int-09.service.ts';

describe('DataloaderBatchingEngineService (API-INT-09)', () => {
  it('batches single entity lookups into a single multi-key database query', async () => {
    let dbQueries = 0;
    const loader = new DataloaderBatchingEngineService(async keys => {
      dbQueries++;
      const map = new Map();
      keys.forEach(k => map.set(k, 'Entity-' + k));
      return map;
    });

    const results = await loader.loadMany([1, 2, 3]);
    assert.strictEqual(dbQueries, 1);
    assert.strictEqual(results.get(1), 'Entity-1');
  });
});
