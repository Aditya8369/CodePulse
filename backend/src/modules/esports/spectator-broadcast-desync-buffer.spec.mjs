import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpectatorBroadcastDesyncBufferService {
  constructor(maxLag = 2000) { this.maxLag = maxLag; }
  eval(serverTime, frameTime) {
    const lag = Math.max(0, serverTime - frameTime);
    if (lag > this.maxLag) return { action: 'FAST_FORWARD', lag };
    return { action: 'STREAM', lag };
  }
}

describe('SpectatorBroadcastDesyncBufferService (#2321)', () => {
  test('fast-forwards spectator stream buffers when desync latency breaches 2000ms', () => {
    const buffer = new SpectatorBroadcastDesyncBufferService(2000);
    const good = buffer.eval(10000, 9500); // 500ms lag
    assert.strictEqual(good.action, 'STREAM');

    const bad = buffer.eval(10000, 7000); // 3000ms lag
    assert.strictEqual(bad.action, 'FAST_FORWARD');
    assert.strictEqual(bad.lag, 3000);
  });
});
