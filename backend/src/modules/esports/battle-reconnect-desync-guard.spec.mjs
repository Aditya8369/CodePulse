import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BattleReconnectDesyncGuardService {
  catchup(cSeq, sSeq, history) {
    if (sSeq - cSeq > 500) return { deltas: [], full: true };
    const deltas = history.filter(d => d.seq > cSeq && d.seq <= sSeq);
    return { deltas, full: false };
  }
}

describe('BattleReconnectDesyncGuardService (#2337)', () => {
  test('reconciles reconnected clients with missed delta frames or triggers full sync', () => {
    const guard = new BattleReconnectDesyncGuardService();
    const history = [
      { seq: 10, action: 'MOVE' },
      { seq: 11, action: 'ATTACK' },
      { seq: 12, action: 'DEFEND' },
    ];
    const res = guard.catchup(10, 12, history);
    assert.strictEqual(res.full, false);
    assert.strictEqual(res.deltas.length, 2);
    assert.strictEqual(res.deltas[0].seq, 11);
  });
});
