import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CrdtDatabaseTableResolverService {
  resolve(local, remote) {
    if (remote.version > local.version) return remote;
    if (remote.version === local.version) {
      return remote.updatedAt >= local.updatedAt ? remote : local;
    }
    return local;
  }
}

describe('CrdtDatabaseTableResolverService (#2147)', () => {
  test('resolves multi-master row mutations deterministically using version vectors', () => {
    const resolver = new CrdtDatabaseTableResolverService();
    const r1 = { rowId: '1', version: 1, updatedAt: 1000, values: { name: 'A' } };
    const r2 = { rowId: '1', version: 2, updatedAt: 1050, values: { name: 'B' } };

    const resolved = resolver.resolve(r1, r2);
    assert.strictEqual(resolved.values.name, 'B');
    assert.strictEqual(resolved.version, 2);
  });
});
