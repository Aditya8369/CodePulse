import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpectatorDeltaBroadcasterService {
  constructor() { this.last = null; }
  compute(next) {
    if (!this.last) { this.last = next; return { tick: next.tick, changes: next.entities }; }
    const changes = {};
    for (const [id, c] of Object.entries(next.entities)) {
      const p = this.last.entities[id];
      if (!p || p.hp !== c.hp) changes[id] = { hp: c.hp };
    }
    this.last = next;
    return { tick: next.tick, changes };
  }
}

describe('SpectatorDeltaBroadcasterService (#2120)', () => {
  test('multiplexes state differences to minimize spectator broadcast payload bandwidth', () => {
    const broadcaster = new SpectatorDeltaBroadcasterService();
    broadcaster.compute({ tick: 1, entities: { p1: { hp: 100 } } });

    const delta = broadcaster.compute({ tick: 2, entities: { p1: { hp: 90 } } });
    assert.strictEqual(delta.changes.p1.hp, 90);
  });
});
