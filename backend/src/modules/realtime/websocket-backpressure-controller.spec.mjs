import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebSocketBackpressureControllerService {
  constructor(limit = 20) { this.l = limit; }
  shouldDropFrame(q, crit) { if (crit) return false; return q > this.l; }
}

describe('WebSocketBackpressureControllerService (Issue #1923)', () => {
  it('should shed transient battle frames when client WebSocket buffer overflows', () => {
    const controller = new WebSocketBackpressureControllerService(20);
    assert.equal(controller.shouldDropFrame(10, false), false);
    assert.equal(controller.shouldDropFrame(25, false), true);
    assert.equal(controller.shouldDropFrame(25, true), false, 'Critical frames must never drop');
  });
});
