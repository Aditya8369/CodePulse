import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SocialGraphOrphanCascadeVerifierService {
  constructor() { this.e = new Set(); }
  add(u, v) { this.e.add(`${u}:${v}`); }
  deleteCascade(node) {
    let count = 0;
    for (const edge of Array.from(this.e)) {
      const [u, v] = edge.split(':');
      if (u === node || v === node) {
        this.e.delete(edge);
        count++;
      }
    }
    return count;
  }
}

describe('SocialGraphOrphanCascadeVerifierService (#2374)', () => {
  test('cascades deletion of nodes to purge all incident dangling edges', () => {
    const verifier = new SocialGraphOrphanCascadeVerifierService();
    verifier.add('user1', 'user2');
    verifier.add('user1', 'user3');
    verifier.add('user2', 'user3');

    const purged = verifier.deleteCascade('user1');
    assert.strictEqual(purged, 2);
    assert.strictEqual(verifier.e.size, 1);
    assert.ok(verifier.e.has('user2:user3'));
  });
});
