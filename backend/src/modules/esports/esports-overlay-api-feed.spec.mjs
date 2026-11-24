import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EsportsOverlayApiFeedService {
  feed(id, r, a, b, phase) {
    return { id, round: r, teamA: a, teamB: b, phase };
  }
}

describe('EsportsOverlayApiFeedService (#2331)', () => {
  test('structures broadcast overlay WebSocket frames for live streaming production graphics', () => {
    const feed = new EsportsOverlayApiFeedService();
    const frame = feed.feed('match-101', 3, { name: 'Alpha', score: 2 }, { name: 'Omega', score: 1 }, 'LIVE');
    assert.strictEqual(frame.round, 3);
    assert.strictEqual(frame.teamA.score, 2);
    assert.strictEqual(frame.phase, 'LIVE');
  });
});
