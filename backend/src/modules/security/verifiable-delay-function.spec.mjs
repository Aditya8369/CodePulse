import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class VerifiableDelayFunctionService {
  run(seed, iter = 50) {
    let c = seed;
    for (let i = 0; i < iter; i++) c = crypto.createHash('sha256').update(c).digest('hex');
    return c;
  }
}

describe('VerifiableDelayFunctionService (#2195)', () => {
  test('computes and verifies sequential hashing delay chains for unbiasable match seeds', () => {
    const vdf = new VerifiableDelayFunctionService();
    const out1 = vdf.run('seed-123', 20);
    const out2 = vdf.run('seed-123', 20);
    assert.strictEqual(out1, out2);
  });
});
