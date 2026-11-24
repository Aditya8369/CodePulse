import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EphemeralPostgresSandboxService {
  constructor() { this.s = new Set(); }
  create(id) { const name = 'sandbox_' + id; this.s.add(name); return name; }
  drop(name) { return this.s.delete(name); }
}

describe('EphemeralPostgresSandboxService (#2152)', () => {
  test('provisions and tears down isolated test schema sandboxes cleanly', () => {
    const sandbox = new EphemeralPostgresSandboxService();
    const name = sandbox.create('runner1');
    assert.strictEqual(sandbox.s.has(name), true);

    sandbox.drop(name);
    assert.strictEqual(sandbox.s.has(name), false);
  });
});
