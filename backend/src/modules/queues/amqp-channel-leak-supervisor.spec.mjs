import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AmqpChannelLeakSupervisorService {
  constructor() { this.c = new Map(); }
  reg(id, time = Date.now()) { this.c.set(id, { id, last: time }); }
  sweep(timeout = 30000) {
    const now = Date.now();
    const closed = [];
    for (const [id, ch] of this.c.entries()) {
      if (now - ch.last > timeout) {
        closed.push(id);
        this.c.delete(id);
      }
    }
    return { count: closed.length, closed };
  }
}

describe('AmqpChannelLeakSupervisorService (#2305)', () => {
  test('detects and reclaims abandoned AMQP channels before socket exhaustion', () => {
    const sup = new AmqpChannelLeakSupervisorService();
    const oldTime = Date.now() - 40000;
    sup.reg('ch-old', oldTime);
    sup.reg('ch-active', Date.now());

    const result = sup.sweep(30000);
    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.closed, ['ch-old']);
  });
});
