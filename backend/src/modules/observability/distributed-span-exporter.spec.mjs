import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DistributedSpanExporterService {
  constructor(max = 3) { this.b = []; this.max = max; }
  exportSpan(s) {
    if (this.b.length >= this.max) return false;
    this.b.push(s);
    return true;
  }
  drainBatch(sz) { return this.b.splice(0, sz); }
}

describe('DistributedSpanExporterService (Issue #1906)', () => {
  it('should buffer trace spans and apply adaptive backpressure when queue is full', () => {
    const exporter = new DistributedSpanExporterService(2);
    assert.equal(exporter.exportSpan({ traceId: '1', spanId: 'a', name: 'http', durationMs: 10 }), true);
    assert.equal(exporter.exportSpan({ traceId: '2', spanId: 'b', name: 'http', durationMs: 12 }), true);
    assert.equal(exporter.exportSpan({ traceId: '3', spanId: 'c', name: 'http', durationMs: 15 }), false, 'Queue full');

    const batch = exporter.drainBatch(2);
    assert.equal(batch.length, 2);
    assert.equal(exporter.exportSpan({ traceId: '4', spanId: 'd', name: 'http', durationMs: 20 }), true);
  });
});
