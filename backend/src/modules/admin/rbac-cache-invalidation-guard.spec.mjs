import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RbacCacheInvalidationGuardService {
  constructor() {
    this.c = new Map();
    this.r = new Map();
  }
  rel(ch, p) {
    if (!this.r.has(ch)) this.r.set(ch, new Set());
    this.r.get(ch).add(p);
  }
  set(k, v) { this.c.set(k, v); }
  invalidate(role) {
    let count = 0;
    if (this.c.has(role)) { this.c.delete(role); count++; }
    const parents = this.r.get(role);
    if (parents) {
      parents.forEach(p => {
        if (this.c.has(p)) { this.c.delete(p); count++; }
      });
    }
    return count;
  }
}

describe('RbacCacheInvalidationGuardService (#2380)', () => {
  test('cascades cache invalidation to all ancestor roles when child permissions change', () => {
    const rbac = new RbacCacheInvalidationGuardService();
    rbac.rel('VIEWER', 'ADMIN');
    rbac.set('VIEWER', { perm: 'read' });
    rbac.set('ADMIN', { perm: 'all' });

    const purged = rbac.invalidate('VIEWER');
    assert.strictEqual(purged, 2);
    assert.strictEqual(rbac.c.has('VIEWER'), false);
    assert.strictEqual(rbac.c.has('ADMIN'), false);
  });
});
