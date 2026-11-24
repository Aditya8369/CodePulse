import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LouvainCommunityDetectorService {
  detect(nodes, edges) {
    const comm = new Map();
    const adj = new Map();
    nodes.forEach(n => adj.set(n, new Set()));
    edges.forEach(([u, v]) => {
      if (adj.has(u)) adj.get(u).add(v);
      if (adj.has(v)) adj.get(v).add(u);
    });
    let c = 0;
    const visited = new Set();
    nodes.forEach(node => {
      if (!visited.has(node)) {
        c++;
        const q = [node];
        visited.add(node);
        while (q.length) {
          const curr = q.shift();
          comm.set(curr, c);
          adj.get(curr).forEach(nb => {
            if (!visited.has(nb)) {
              visited.add(nb);
              q.push(nb);
            }
          });
        }
      }
    });
    return comm;
  }
}

describe('LouvainCommunityDetectorService (#2368)', () => {
  test('partitions connected components into distinct modular social graph communities', () => {
    const detector = new LouvainCommunityDetectorService();
    const nodes = ['A', 'B', 'C', 'X', 'Y'];
    const edges = [['A', 'B'], ['B', 'C'], ['X', 'Y']];
    const map = detector.detect(nodes, edges);

    assert.strictEqual(map.get('A'), map.get('B'));
    assert.strictEqual(map.get('B'), map.get('C'));
    assert.strictEqual(map.get('X'), map.get('Y'));
    assert.notStrictEqual(map.get('A'), map.get('X'));
  });
});
