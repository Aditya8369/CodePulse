import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AdaptiveFrameDropperService {
  constructor() {
    this.lags = new Map();
  }
  update(id, rtt) { this.lags.set(id, rtt); }
  shouldDrop(id, f) {
    if (f.isKeyframe || f.priority === 'CRITICAL') return false;
    const rtt = this.lags.get(id) || 50;
    if (rtt > 300) return true;
    if (rtt > 150 && f.priority === 'LOW') return true;
    return false;
  }
}

describe('AdaptiveFrameDropperService (#2116)', () => {
  test('drops low priority frames on high latency clients while protecting keyframes', () => {
    const dropper = new AdaptiveFrameDropperService();
    dropper.update('client-lagging', 350);

    const normalFrame = { frameId: 1, isKeyframe: false, priority: 'NORMAL', data: 'pos' };
    const keyFrame = { frameId: 2, isKeyframe: true, priority: 'NORMAL', data: 'full_state' };

    assert.strictEqual(dropper.shouldDrop('client-lagging', normalFrame), true);
    assert.strictEqual(dropper.shouldDrop('client-lagging', keyFrame), false);
  });
});
