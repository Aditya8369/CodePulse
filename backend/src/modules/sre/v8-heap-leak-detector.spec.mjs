import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class V8HeapLeakDetectorService {
  constructor() { this.samples = []; }
  recordSample(bytes, ts) { this.samples.push({ usedBytes: bytes, timestamp: ts }); }
  detectSustainedGrowthSlope() {
    if (this.samples.length < 3) return { isLeaking: false };
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.timestamp - first.timestamp) / 1000;
    const slope = (last.usedBytes - first.usedBytes) / dt;
    let monotonic = true;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].usedBytes <= this.samples[i - 1].usedBytes) { monotonic = false; break; }
    }
    return { isLeaking: monotonic && slope > 1000, slope };
  }
}

describe('V8HeapLeakDetectorService (Issue #1868)', () => {
  it('should detect sustained monotonic heap memory growth slopes', () => {
    const detector = new V8HeapLeakDetectorService();
    detector.recordSample(1000000, 1000);
    detector.recordSample(3000000, 2000);
    detector.recordSample(6000000, 3000);

    const res = detector.detectSustainedGrowthSlope();
    assert.equal(res.isLeaking, true);
    assert.ok(res.slope > 1000);
  });
});
