import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class FinopsIdleResourcePauserService {
  eval(res, thresh = 60) {
    let p = 0, r = 0;
    res.forEach(x => {
      if (!x.isPaused && x.idle >= thresh) { x.isPaused = true; p++; }
      else if (x.isPaused && x.idle === 0) { x.isPaused = false; r++; }
    });
    return { p, r };
  }
}

describe('FinopsIdleResourcePauserService (#2396)', () => {
  test('automatically pauses idle resources and resumes on new activity', () => {
    const pauser = new FinopsIdleResourcePauserService();
    const resources = [
      { id: 'c1', idle: 90, isPaused: false },
      { id: 'c2', idle: 15, isPaused: false },
      { id: 'c3', idle: 0, isPaused: true }
    ];

    const res = pauser.eval(resources, 60);
    assert.strictEqual(res.p, 1);
    assert.strictEqual(res.r, 1);
    assert.strictEqual(resources[0].isPaused, true);
    assert.strictEqual(resources[2].isPaused, false);
  });
});
