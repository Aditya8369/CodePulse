import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DoubleElimGrandFinalsResetService {
  eval(wbSeed, lbSeed, m1, m2) {
    if (m1 === wbSeed) return { champion: wbSeed, reset: false, done: true };
    if (!m2) return { champion: '', reset: true, done: false };
    return { champion: m2, reset: true, done: true };
  }
}

describe('DoubleElimGrandFinalsResetService (#2317)', () => {
  test('handles double-elimination grand finals and bracket reset requirements', () => {
    const gf = new DoubleElimGrandFinalsResetService();
    // Case 1: WB player wins match 1
    const res1 = gf.eval('PlayerA', 'PlayerB', 'PlayerA');
    assert.strictEqual(res1.champion, 'PlayerA');
    assert.strictEqual(res1.reset, false);
    assert.strictEqual(res1.done, true);

    // Case 2: LB player wins match 1 -> requires match 2
    const res2 = gf.eval('PlayerA', 'PlayerB', 'PlayerB');
    assert.strictEqual(res2.reset, true);
    assert.strictEqual(res2.done, false);

    // Case 3: LB player wins reset match 2
    const res3 = gf.eval('PlayerA', 'PlayerB', 'PlayerB', 'PlayerB');
    assert.strictEqual(res3.champion, 'PlayerB');
    assert.strictEqual(res3.done, true);
  });
});
