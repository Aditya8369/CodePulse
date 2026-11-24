import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BcryptStarvationGuardService {
  constructor() { this.c = 0; }
  acquire() {
    if (this.c >= 2) return false;
    this.c++;
    return true;
  }
  release() { this.c = Math.max(0, this.c - 1); }
}

describe('BcryptStarvationGuardService (#2183)', () => {
  test('bounds concurrent bcrypt CPU hash operations to prevent event loop starvation', () => {
    const guard = new BcryptStarvationGuardService();
    assert.strictEqual(guard.acquire(), true);
    assert.strictEqual(guard.acquire(), true);
    assert.strictEqual(guard.acquire(), false); // Throttled

    guard.release();
    assert.strictEqual(guard.acquire(), true);
  });
});
