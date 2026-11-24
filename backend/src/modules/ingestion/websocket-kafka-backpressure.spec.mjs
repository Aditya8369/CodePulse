import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebSocketKafkaBackpressureService {
  constructor(low = 2000, high = 5000) {
    this.low = low;
    this.high = high;
    this.state = 'NORMAL';
  }
  updateQueueDepth(depth) {
    if (depth >= this.high) this.state = 'PAUSED';
    else if (depth >= this.low) this.state = 'DEGRADED';
    else this.state = 'NORMAL';
    return this.state;
  }
  shouldAcceptFrame(frame) {
    if (this.state === 'NORMAL') return true;
    if (this.state === 'DEGRADED') return frame.type === 'critical';
    return false;
  }
}

describe('WebSocketKafkaBackpressureService (Issue #1804)', () => {
  it('should shed non-critical telemetry in degraded mode and pause all frames at high watermark', () => {
    const controller = new WebSocketKafkaBackpressureService(2000, 5000);

    controller.updateQueueDepth(1000);
    assert.equal(controller.shouldAcceptFrame({ type: 'telemetry', data: {} }), true);

    controller.updateQueueDepth(3000); // Degraded
    assert.equal(controller.shouldAcceptFrame({ type: 'telemetry', data: {} }), false, 'Must drop telemetry in degraded mode');
    assert.equal(controller.shouldAcceptFrame({ type: 'critical', data: {} }), true, 'Must preserve critical messages');

    controller.updateQueueDepth(6000); // Paused
    assert.equal(controller.shouldAcceptFrame({ type: 'critical', data: {} }), false, 'Must pause all frames at high watermark');
  });
});
