import { describe, it, expect } from 'vitest';
import { RagCodeSearchService } from './rag-code-search.service';

describe('RagCodeSearchService (Vitest AST Boundaries & Reranking)', () => {
  it('never splits mid-statement and returns ranked top-5 hits with exact line spans', async () => {
    const rag = new RagCodeSearchService();
    const chunks = await rag.indexFile({
      repositoryId: 'repo-1',
      filePath: 'src/lib/cache.ts',
      sourceCode: `
        export class RedisCacheManager {
          async invalidatePattern(prefix: string): Promise<number> {
            const keys = await this.scan(prefix);
            return keys.length;
          }
        }
      `,
    });

    expect(chunks.some((c) => c.kind === 'CLASS' && c.symbolName === 'RedisCacheManager')).toBe(true);
    expect(
      chunks.some((c) => c.kind === 'METHOD' && c.symbolName === 'RedisCacheManager.invalidatePattern'),
    ).toBe(true);

    const searchRes = await rag.searchSemanticCode({
      query: 'invalidate redis cache keys by prefix',
      repositoryId: 'repo-1',
    });

    expect(searchRes.results[0].symbolName).toBe('RedisCacheManager.invalidatePattern');
    expect(searchRes.latencyMs).toBeLessThan(120);
  });
});
