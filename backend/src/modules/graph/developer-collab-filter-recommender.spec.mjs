import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeveloperCollabFilterRecommenderService {
  sim(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] ** 2;
      nB += b[i] ** 2;
    }
    if (!nA || !nB) return 0;
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
  }
}

describe('DeveloperCollabFilterRecommenderService (#2366)', () => {
  test('computes cosine similarity accurately between feature vectors', () => {
    const service = new DeveloperCollabFilterRecommenderService();
    const vec1 = [1, 1, 0];
    const vec2 = [1, 1, 0];
    assert.strictEqual(Math.round(service.sim(vec1, vec2) * 100) / 100, 1.0);

    const vecOrthogonal = [0, 0, 1];
    assert.strictEqual(service.sim(vec1, vecOrthogonal), 0);
  });
});
