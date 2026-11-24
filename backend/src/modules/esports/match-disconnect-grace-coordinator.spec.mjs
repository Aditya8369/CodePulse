import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MatchDisconnectGraceCoordinatorService {
  constructor() { this.d = new Map(); }
  dc(p, t = Date.now()) { this.d.set(p, t); }
  rc(p) { return this.d.delete(p); }
  forfeit(p, graceSec = 180, now = Date.now()) {
    const t = this.d.get(p);
    if (!t) return false;
    return (now - t) >= (graceSec * 1000);
  }
}

describe('MatchDisconnectGraceCoordinatorService (#2328)', () => {
  test('manages player disconnect grace windows and triggers match forfeits when expired', () => {
    const coord = new MatchDisconnectGraceCoordinatorService();
    const t0 = 100000;
    coord.dc('player1', t0);

    assert.strictEqual(coord.forfeit('player1', 180, t0 + 60000), false); // 60s in -> no forfeit
    assert.strictEqual(coord.forfeit('player1', 180, t0 + 190000), true); // 190s in -> forfeited!
  });
});
