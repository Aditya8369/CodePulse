import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GraphqlComplexityAnalyzerService } from './api-int-01.service.ts';

describe('GraphqlComplexityAnalyzerService (API-INT-01)', () => {
  it('allows safe shallow queries and rejects nested recursive GraphQL queries', () => {
    const analyzer = new GraphqlComplexityAnalyzerService(50, 3);
    const safe = analyzer.analyzeQueryString('{ user { id name } }');
    assert.strictEqual(safe.allowed, true);
    assert.strictEqual(safe.depth, 2);

    const deeplyNested = analyzer.analyzeQueryString('{ user { friends { friends { friends { id } } } } }');
    assert.strictEqual(deeplyNested.allowed, false);
    assert.strictEqual(deeplyNested.reason, 'QUERY_DEPTH_EXCEEDED');
  });
});
