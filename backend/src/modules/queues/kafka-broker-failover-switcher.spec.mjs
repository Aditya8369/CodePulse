import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KafkaBrokerFailoverSwitcherService {
  constructor() {
    this.b = ['b1', 'b2', 'b3'];
    this.idx = 0;
    this.failed = new Set();
  }
  get() { return this.b[this.idx]; }
  fail(broker) {
    this.failed.add(broker);
    for (let i = 0; i < this.b.length; i++) {
      const nextIdx = (this.idx + 1 + i) % this.b.length;
      if (!this.failed.has(this.b[nextIdx])) {
        this.idx = nextIdx;
        return this.b[nextIdx];
      }
    }
    this.failed.clear();
    this.idx = (this.idx + 1) % this.b.length;
    return this.b[this.idx];
  }
}

describe('KafkaBrokerFailoverSwitcherService (#2296)', () => {
  test('dynamically fails over client connections to secondary kafka brokers', () => {
    const switcher = new KafkaBrokerFailoverSwitcherService();
    assert.strictEqual(switcher.get(), 'b1');
    const next = switcher.fail('b1');
    assert.strictEqual(next, 'b2');
    assert.strictEqual(switcher.get(), 'b2');
  });
});
