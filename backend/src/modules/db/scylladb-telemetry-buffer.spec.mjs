import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ScyllaDBTelemetryBufferService {
  constructor(threshold = 50) { this.threshold = threshold; this.buf = []; }
  record(p) { this.buf.push(p); return this.buf.length >= this.threshold; }
  flush() { const out = [...this.buf]; this.buf = []; return out; }
}

describe('ScyllaDBTelemetryBufferService (Issue #1826)', () => {
  it('should buffer telemetry points and signal flush upon reaching threshold', () => {
    const buffer = new ScyllaDBTelemetryBufferService(3);
    assert.equal(buffer.record({ metric: 'cpu', value: 45, timestamp: 1 }), false);
    assert.equal(buffer.record({ metric: 'cpu', value: 46, timestamp: 2 }), false);
    assert.equal(buffer.record({ metric: 'cpu', value: 50, timestamp: 3 }), true);

    const flushed = buffer.flush();
    assert.equal(flushed.length, 3);
  });
});
