import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ZipBombDecompressionGuardService {
  check(comp, decomp) {
    if (decomp > 10000000) return false;
    if (comp > 0 && decomp / comp > 100) return false;
    return true;
  }
}

describe('ZipBombDecompressionGuardService (#2194)', () => {
  test('aborts decompression of explosive zip bombs with excessive compression ratios', () => {
    const guard = new ZipBombDecompressionGuardService();
    assert.strictEqual(guard.check(1000, 2000), true);
    assert.strictEqual(guard.check(100, 100000), false); // 1000:1 ratio zip bomb
  });
});
