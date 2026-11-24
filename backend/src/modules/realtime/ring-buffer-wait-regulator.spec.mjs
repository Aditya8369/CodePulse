import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RingBufferWaitRegulatorService {
  select(s) {
    if (s < 100) return 'SPIN';
    if (s < 1000) return 'YIELD';
    return 'SLEEP';
  }
}

describe('RingBufferWaitRegulatorService (#2133)', () => {
  test('regulates wait strategy dynamically from busy spin to yield and sleep', () => {
    const regulator = new RingBufferWaitRegulatorService();
    assert.strictEqual(regulator.select(50), 'SPIN');
    assert.strictEqual(regulator.select(500), 'YIELD');
    assert.strictEqual(regulator.select(2000), 'SLEEP');
  });
});
