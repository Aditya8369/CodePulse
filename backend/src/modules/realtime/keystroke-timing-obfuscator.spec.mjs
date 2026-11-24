import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KeystrokeTimingObfuscatorService {
  quantize(ts) { return Math.floor(ts / 50) * 50; }
}

describe('KeystrokeTimingObfuscatorService (#2117)', () => {
  test('quantizes keystroke intervals into 50ms buckets to prevent timing side-channel attacks', () => {
    const obf = new KeystrokeTimingObfuscatorService();
    assert.strictEqual(obf.quantize(1023), 1000);
    assert.strictEqual(obf.quantize(1049), 1000);
    assert.strictEqual(obf.quantize(1051), 1050);
  });
});
