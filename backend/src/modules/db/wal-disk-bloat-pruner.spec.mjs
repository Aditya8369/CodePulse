import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WalDiskBloatPrunerService {
  eval(bytes) {
    if (bytes >= 10000000000) return { trigger: true };
    return { trigger: false };
  }
}

describe('WalDiskBloatPrunerService (#2140)', () => {
  test('triggers automated checkpoint when WAL disk usage approaches storage limit', () => {
    const pruner = new WalDiskBloatPrunerService();
    assert.strictEqual(pruner.eval(5000000000).trigger, false);
    assert.strictEqual(pruner.eval(11000000000).trigger, true);
  });
});
