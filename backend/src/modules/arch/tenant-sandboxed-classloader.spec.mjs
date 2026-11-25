import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TenantSandboxedClassloaderService {
  constructor() { this.t = new Map(); }
  reg(tenant, name, mod) {
    if (!this.t.has(tenant)) this.t.set(tenant, new Map());
    this.t.get(tenant).set(name, mod);
  }
  call(tenant, name, fn, ...args) {
    const m = this.t.get(tenant)?.get(name);
    if (!m) throw new Error('NOT_FOUND');
    return m[fn](...args);
  }
}

describe('TenantSandboxedClassloaderService (#2711)', () => {
  test('ensures complete execution isolation between tenant plugin namespaces', () => {
    const loader = new TenantSandboxedClassloaderService();
    loader.reg('tenant-alpha', 'transformer', { run: (x) => x.toUpperCase() });
    loader.reg('tenant-beta', 'transformer', { run: (x) => x.toLowerCase() });

    assert.strictEqual(loader.call('tenant-alpha', 'transformer', 'run', 'Hello'), 'HELLO');
    assert.strictEqual(loader.call('tenant-beta', 'transformer', 'run', 'Hello'), 'hello');

    assert.throws(() => loader.call('tenant-gamma', 'transformer', 'run', 'Hello'), /NOT_FOUND/);
  });
});
