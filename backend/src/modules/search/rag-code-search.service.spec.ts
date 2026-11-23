import { RagCodeSearchService } from './rag-code-search.service';

describe('RagCodeSearchService (Hierarchical AST Chunking, Multi-Vector Hybrid & MRR > 0.8)', () => {
  let service: RagCodeSearchService;

  beforeEach(() => {
    service = new RagCodeSearchService();
  });

  it('splits code cleanly along AST Class/Method/Export boundaries and achieves MRR > 0.8 in < 120ms', async () => {
    await service.indexFile({
      repositoryId: 'codepulse',
      filePath: 'backend/src/modules/auth/auth.service.ts',
      sourceCode: `
        export class AuthService {
          async refreshJwtTokens(refreshToken: string) {
            const payload = await this.jwtService.verifyAsync(refreshToken);
            return this.issueTokenPair(payload.sub);
          }

          async logoutUser(userId: string) {
            return this.redis.del(\`session:\${userId}\`);
          }
        }
      `,
    });

    await service.indexFile({
      repositoryId: 'codepulse',
      filePath: 'backend/src/modules/ws/ws-auth.guard.ts',
      sourceCode: `
        export function authenticateWebSocketClient(handshakeToken: string) {
          if (!handshakeToken) throw new Error('Missing WS bearer token');
          return verifySocketJwt(handshakeToken);
        }
      `,
    });

    const queries = [
      { q: 'where is JWT refreshed', expectedSymbol: 'AuthService.refreshJwtTokens' },
      { q: 'how are WebSockets authenticated', expectedSymbol: 'authenticateWebSocketClient' },
    ];

    let reciprocalRankSum = 0;
    for (const item of queries) {
      const resp = await service.searchSemanticCode({
        query: item.q,
        repositoryId: 'codepulse',
        topK: 5,
      });

      expect(resp.latencyMs).toBeLessThan(120);
      expect(resp.results.length).toBeGreaterThan(0);
      expect(resp.results[0].startLine).toBeGreaterThan(0);
      expect(resp.results[0].endLine).toBeGreaterThanOrEqual(resp.results[0].startLine);

      const rankIdx = resp.results.findIndex((r) => r.symbolName === item.expectedSymbol);
      expect(rankIdx).toBeGreaterThanOrEqual(0);
      reciprocalRankSum += 1 / (rankIdx + 1);
    }

    const mrr = reciprocalRankSum / queries.length;
    expect(mrr).toBeGreaterThan(0.8);
  });
});
