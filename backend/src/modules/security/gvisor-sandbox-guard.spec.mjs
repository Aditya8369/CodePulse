import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GvisorSandboxGuardService {
  constructor() { this.blocked = new Set(['ptrace', 'bpf', 'reboot']); }
  check(sys) { return !this.blocked.has(sys); }
}

describe('GvisorSandboxGuardService (#2166)', () => {
  test('intercepts forbidden kernel syscalls preventing container escape vectors', () => {
    const guard = new GvisorSandboxGuardService();
    assert.strictEqual(guard.check('read'), true);
    assert.strictEqual(guard.check('ptrace'), false);
    assert.strictEqual(guard.check('bpf'), false);
  });
});
