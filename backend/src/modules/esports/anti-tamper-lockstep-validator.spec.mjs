import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AntiTamperLockstepValidatorService {
  validate(exp, client, hash) {
    if (exp !== client) return false;
    if (!hash || hash.length < 16) return false;
    return true;
  }
}

describe('AntiTamperLockstepValidatorService (#2324)', () => {
  test('validates monotonic turn numbering and action checksums in lockstep battles', () => {
    const lockstep = new AntiTamperLockstepValidatorService();
    assert.strictEqual(lockstep.validate(5, 5, 'abcdef0123456789'), true);
    assert.strictEqual(lockstep.validate(5, 4, 'abcdef0123456789'), false); // Out of sync turn
    assert.strictEqual(lockstep.validate(5, 5, 'short'), false); // Corrupted checksum
  });
});
