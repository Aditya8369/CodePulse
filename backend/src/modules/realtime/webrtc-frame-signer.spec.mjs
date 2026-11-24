import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class WebrtcFrameSignerService {
  constructor() {
    this.secrets = new Map();
    this.seqs = new Map();
  }
  init(id) {
    const s = 'test-secret-32-chars-long-000000000';
    this.secrets.set(id, s);
    this.seqs.set(id, 0);
  }
  sign(id, p) {
    const s = this.secrets.get(id);
    const seq = (this.seqs.get(id) || 0) + 1;
    this.seqs.set(id, seq);
    const ts = 1000;
    const sig = crypto.createHmac('sha256', s).update(`${seq}:${ts}:${p}`).digest('hex');
    return { sequence: seq, payload: p, signature: sig, timestamp: ts };
  }
  verify(id, f) {
    const s = this.secrets.get(id);
    const exp = crypto.createHmac('sha256', s).update(`${f.sequence}:${f.timestamp}:${f.payload}`).digest('hex');
    return f.signature === exp;
  }
}

describe('WebrtcFrameSignerService (#2114)', () => {
  test('signs WebRTC frames with HMAC-SHA256 and detects tampered data', () => {
    const signer = new WebrtcFrameSignerService();
    signer.init('sess-1');

    const frame = signer.sign('sess-1', 'attack_target_coord:10,20');
    assert.strictEqual(signer.verify('sess-1', frame), true);

    const tampered = { ...frame, payload: 'attack_target_coord:99,99' };
    assert.strictEqual(signer.verify('sess-1', tampered), false);
  });
});
