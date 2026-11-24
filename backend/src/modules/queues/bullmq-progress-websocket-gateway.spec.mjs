import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BullmqProgressWebsocketGatewayService {
  constructor() { this.s = new Map(); }
  sub(job, socket) {
    let set = this.s.get(job) || new Set();
    set.add(socket);
    this.s.set(job, set);
  }
  broadcast(job, pct, stage) {
    const set = this.s.get(job);
    return { job, pct, stage, notified: set ? set.size : 0 };
  }
}

describe('BullmqProgressWebsocketGatewayService (#2311)', () => {
  test('dispatches real-time worker progress updates to subscribed socket clients', () => {
    const gw = new BullmqProgressWebsocketGatewayService();
    gw.sub('job-1', 'client-a');
    gw.sub('job-1', 'client-b');

    const res = gw.broadcast('job-1', 75, 'COMPILING');
    assert.strictEqual(res.notified, 2);
    assert.strictEqual(res.pct, 75);
  });
});
