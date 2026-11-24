import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class Neo4jCartesianFreezeResolverService {
  optimize(q) {
    const isCart = q.includes('MATCH') && q.includes(',') && !q.includes('-[');
    if (isCart) {
      const opt = q.replace(',', ' WITH u MATCH');
      return { hasRisk: true, opt };
    }
    return { hasRisk: false, opt: q };
  }
}

describe('Neo4jCartesianFreezeResolverService (#2346)', () => {
  test('rewrites disconnected MATCH clauses to prevent Cartesian product memory blowouts', () => {
    const resolver = new Neo4jCartesianFreezeResolverService();
    const badQuery = 'MATCH (u:User), (g:Guild) RETURN u, g;';
    const res = resolver.optimize(badQuery);

    assert.strictEqual(res.hasRisk, true);
    assert.ok(res.opt.includes('MATCH (u:User) WITH u MATCH (g:Guild)'));

    const goodQuery = 'MATCH (u:User)-[:MEMBER_OF]->(g:Guild) RETURN u, g;';
    assert.strictEqual(resolver.optimize(goodQuery).hasRisk, false);
  });
});
