import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RUMBeaconIngestionBufferService {
  constructor(size = 3) { this.b = []; this.s = size; }
  push(beacon) {
    this.b.push(beacon);
    if (this.b.length >= this.s) { const out = [...this.b]; this.b = []; return out; }
    return null;
  }
  flush() { const out = [...this.b]; this.b = []; return out; }
}

describe('RUMBeaconIngestionBufferService (Issue #1896)', () => {
  it('should buffer Real User Monitoring beacons and flush when capacity threshold is reached', () => {
    const buffer = new RUMBeaconIngestionBufferService(2);
    assert.equal(buffer.push({ sessionId: 's1', metric: 'FCP', value: 300 }), null);
    const flushed = buffer.push({ sessionId: 's2', metric: 'LCP', value: 800 });
    assert.equal(flushed?.length, 2);
  });
});
