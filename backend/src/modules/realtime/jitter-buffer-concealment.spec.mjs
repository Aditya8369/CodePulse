import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class JitterBufferConcealmentEngineService {
  constructor() {
    this.queue = [];
    this.seq = 0;
  }
  push(p) { this.queue.push(p); this.queue.sort((a,b) => a.seq - b.seq); }
  pull(now) {
    if (this.queue.length === 0 || this.queue[0].seq !== this.seq) {
      return { concealed: true, seq: this.seq++ };
    }
    const p = this.queue.shift();
    this.seq++;
    return { concealed: false, seq: p.seq };
  }
}

describe('JitterBufferConcealmentEngineService (#2112)', () => {
  test('conceals missing audio/event frames during packet arrival underruns', () => {
    const engine = new JitterBufferConcealmentEngineService();
    engine.push({ seq: 0, payload: 'frame-0' });
    engine.push({ seq: 2, payload: 'frame-2' }); // Gap at seq 1

    const p0 = engine.pull(100);
    assert.strictEqual(p0.concealed, false);

    const p1 = engine.pull(120);
    assert.strictEqual(p1.concealed, true); // Concealed seq 1

    const p2 = engine.pull(140);
    assert.strictEqual(p2.concealed, false); // Pulled seq 2
  });
});
