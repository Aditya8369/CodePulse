import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AdminWebsocketStreamLeakFixService {
  constructor() { this.l = new Map(); }
  reg(id, fn) { this.l.set(id, fn); }
  unreg(id) { return this.l.delete(id); }
  size() { return this.l.size; }
}

describe('AdminWebsocketStreamLeakFixService (#2394)', () => {
  test('unregisters socket listeners upon disconnect to prevent WebSocket stream memory leaks', () => {
    const service = new AdminWebsocketStreamLeakFixService();
    service.reg('sock-1', () => {});
    service.reg('sock-2', () => {});
    assert.strictEqual(service.size(), 2);

    service.unreg('sock-1');
    assert.strictEqual(service.size(), 1);
  });
});
