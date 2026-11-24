import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SctpCongestionTunerService {
  constructor() {
    this.cwnd = 64000;
    this.ssthresh = 256000;
  }
  ack(b) {
    if (this.cwnd < this.ssthresh) this.cwnd += b;
    return this.cwnd;
  }
  loss() {
    this.ssthresh = Math.floor(this.cwnd / 2);
    this.cwnd = this.ssthresh;
    return this.cwnd;
  }
}

describe('SctpCongestionTunerService (#2119)', () => {
  test('scales congestion window during slow start and backs off on packet loss', () => {
    const tuner = new SctpCongestionTunerService();
    const c1 = tuner.ack(16000);
    assert.strictEqual(c1, 80000);

    const c2 = tuner.loss();
    assert.strictEqual(c2, 40000);
  });
});
