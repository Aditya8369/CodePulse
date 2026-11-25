import { describe, it } from 'node:test';
import assert from 'node:assert';
import { InvertedIndexSearchService } from './arch-svc-61.service.ts';

describe('InvertedIndexSearchService (ARCH-SVC-61)', () => {
  it('indexes documents and performs multi-token intersection searches', () => {
    const search = new InvertedIndexSearchService();
    search.indexDocument('ch-1', 'Binary Search Tree Balancing Algorithm');
    search.indexDocument('ch-2', 'Dynamic Programming Graph Shortest Path');
    search.indexDocument('ch-3', 'Red Black Tree Rotation Balancing');

    const resTreeBalancing = search.search('tree balancing');
    assert.deepStrictEqual(resTreeBalancing.sort(), ['ch-1', 'ch-3']);

    const resGraph = search.search('graph');
    assert.deepStrictEqual(resGraph, ['ch-2']);
  });
});
