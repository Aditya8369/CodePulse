import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HierarchicalRbacCacheService } from './arch-svc-73.service.ts';

describe('HierarchicalRbacCacheService (ARCH-SVC-73)', () => {
  it('resolves inherited permissions transitively and caches results', () => {
    const rbac = new HierarchicalRbacCacheService();
    rbac.defineRole('USER', [], ['view:profile']);
    rbac.defineRole('EDITOR', ['USER'], ['edit:content']);
    rbac.defineRole('ADMIN', ['EDITOR'], ['manage:users']);

    assert.strictEqual(rbac.hasPermission('ADMIN', 'view:profile'), true);
    assert.strictEqual(rbac.hasPermission('ADMIN', 'edit:content'), true);
    assert.strictEqual(rbac.hasPermission('ADMIN', 'manage:users'), true);
    assert.strictEqual(rbac.hasPermission('USER', 'edit:content'), false);
  });
});
