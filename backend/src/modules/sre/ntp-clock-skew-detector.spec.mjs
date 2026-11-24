import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class NtpClockSkewDetectorService {
  skew(local, ntp) {
    const s = Math.abs(local - ntp);
    return { skewMs: s, outOfSync: s > 250 };
  }
}

describe('NtpClockSkewDetectorService (#2223)', () => {
  test('flags severe system clock skew threatening distributed timestamping', () => {
    const detector = new NtpClockSkewDetectorService();
    assert.strictEqual(detector.skew(1000, 1050).outOfSync, false);
    assert.strictEqual(detector.skew(1000, 1400).outOfSync, true);
  });
});
