import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeveloperNetworkCentralityEngineService {
  calc(node, edges) {
    let deg = 0;
    const all = new Set();
    for (const [a, b] of edges) {
      all.add(a); all.add(b);
      if (a === node || b === node) deg++;
    }
    const max = Math.max(1, all.size - 1);
    return { node, degree: deg, score: parseFloat((deg / max).toFixed(3)) };
  }
}

describe('DeveloperNetworkCentralityEngineService (#2348)', () => {
  test('computes connection degree and centrality score across collaboration graphs', () => {
    const engine = new DeveloperNetworkCentralityEngineService();
    const edges = [
      ['Alice', 'Bob'],
      ['Alice', 'Charlie'],
      ['Alice', 'David'],
      ['Bob', 'Charlie'],
    ];
    const alice = engine.calc('Alice', edges);
    assert.strictEqual(alice.degree, 3);
    assert.strictEqual(alice.score, 1.0); // Connected to all 3 other developers

    const david = engine.calc('David', edges);
    assert.strictEqual(david.degree, 1);
    assert.strictEqual(david.score, 0.333);
  });
});
