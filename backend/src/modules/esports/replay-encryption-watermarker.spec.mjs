import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class ReplayEncryptionWatermarkerService {
  sign(mId, data, key) {
    const sig = crypto.createHmac('sha256', key).update(`${mId}:${data}`).digest('hex');
    return { data: `CP_REPLAY_V1:${sig}:${data}`, sig };
  }
  verify(mId, str, key) {
    const p = str.split(':');
    if (p.length < 3 || p[0] !== 'CP_REPLAY_V1') return false;
    const raw = p.slice(2).join(':');
    const exp = crypto.createHmac('sha256', key).update(`${mId}:${raw}`).digest('hex');
    return p[1] === exp;
  }
}

describe('ReplayEncryptionWatermarkerService (#2345)', () => {
  test('cryptographically watermarks replay files and verifies tamper authenticity', () => {
    const watermarker = new ReplayEncryptionWatermarkerService();
    const signed = watermarker.sign('match-77', 'FRAME_001_MOVE_A_ATTACK', 'super-secret-salt');
    assert.strictEqual(watermarker.verify('match-77', signed.data, 'super-secret-salt'), true);
    assert.strictEqual(watermarker.verify('match-77', signed.data + '_tampered', 'super-secret-salt'), false);
  });
});
