import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EventReplayGatewayService {
  constructor() { this.eventLog = []; }
  appendEvent(e) { this.eventLog.push(e); }
  extractReplaySlice(w) {
    return this.eventLog
      .filter(e => e.battleId === w.battleId && e.timestampMs >= w.startMs && e.timestampMs <= w.endMs)
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }
  simulateReplay(slice, sink) {
    let count = 0;
    for (const e of slice) { sink(e); count++; }
    return count;
  }
}

describe('EventReplayGatewayService (Issue #1810)', () => {
  it('should slice chronological events within timestamp window and replay into downstream sink', () => {
    const gateway = new EventReplayGatewayService();
    gateway.appendEvent({ id: 'e1', battleId: 'b-1', eventType: 'JOIN', timestampMs: 100, payload: {} });
    gateway.appendEvent({ id: 'e2', battleId: 'b-1', eventType: 'CODE_EDIT', timestampMs: 200, payload: {} });
    gateway.appendEvent({ id: 'e3', battleId: 'b-2', eventType: 'JOIN', timestampMs: 250, payload: {} });
    gateway.appendEvent({ id: 'e4', battleId: 'b-1', eventType: 'SUBMIT', timestampMs: 300, payload: {} });

    const slice = gateway.extractReplaySlice({ battleId: 'b-1', startMs: 150, endMs: 350 });
    assert.equal(slice.length, 2);
    assert.equal(slice[0].id, 'e2');
    assert.equal(slice[1].id, 'e4');

    const sinkEvents = [];
    const count = gateway.simulateReplay(slice, e => sinkEvents.push(e.id));
    assert.equal(count, 2);
    assert.deepEqual(sinkEvents, ['e2', 'e4']);
  });
});
