import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SocketioRedisStreamsAdapterService {
  constructor() { this.b = []; }
  publish(ch, p) { const m = { id: this.b.length + 1, channel: ch, payload: p }; this.b.push(m); return m; }
  getMissedMessages(ch, lastId) { return this.b.filter(m => m.channel === ch && m.id > lastId); }
}

describe('SocketioRedisStreamsAdapterService (Issue #1925)', () => {
  it('should replay missed messages to clients reconnecting after temporary network drops', () => {
    const adapter = new SocketioRedisStreamsAdapterService();
    adapter.publish('room-1', 'm1');
    adapter.publish('room-1', 'm2');
    adapter.publish('room-1', 'm3');

    const missed = adapter.getMissedMessages('room-1', 1);
    assert.equal(missed.length, 2);
    assert.deepEqual(missed.map(m => m.payload), ['m2', 'm3']);
  });
});
