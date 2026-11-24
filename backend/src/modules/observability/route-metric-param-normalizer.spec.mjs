import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RouteMetricParamNormalizerService {
  normalize(p) {
    return p.replace(/\/[0-9a-fA-F-]{36}/g, '/:id').replace(/\/[0-9]+/g, '/:id');
  }
}

describe('RouteMetricParamNormalizerService (#2239)', () => {
  test('normalizes raw URLs to parameterized routes preventing label cardinality explosion', () => {
    const normalizer = new RouteMetricParamNormalizerService();
    assert.strictEqual(normalizer.normalize('/api/users/123/profile'), '/api/users/:id/profile');
    assert.strictEqual(normalizer.normalize('/api/matches/550e8400-e29b-41d4-a716-446655440000'), '/api/matches/:id');
  });
});
