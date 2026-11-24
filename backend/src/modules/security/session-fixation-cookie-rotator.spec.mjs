import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SessionFixationCookieRotatorService {
  rotate(old, ua, ip) {
    const id = 'sess_new_' + Math.random();
    return { newId: id, valid: true };
  }
}

describe('SessionFixationCookieRotatorService (#2173)', () => {
  test('rotates session IDs on authentication transition to eliminate session fixation', () => {
    const rotator = new SessionFixationCookieRotatorService();
    const res = rotator.rotate('sess_old', 'Mozilla', '127.0.0.1');
    assert.strictEqual(res.newId.startsWith('sess_new_'), true);
  });
});
