import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RbacPermissionMatrixEvaluatorService {
  constructor() {
    this.perms = { ADMIN: new Set(['READ', 'DELETE']), USER: new Set(['READ']) };
  }
  can(r, p) { return this.perms[r]?.has(p) || false; }
}

describe('RbacPermissionMatrixEvaluatorService (#2190)', () => {
  test('evaluates role permissions accurately across user tiers', () => {
    const rbac = new RbacPermissionMatrixEvaluatorService();
    assert.strictEqual(rbac.can('ADMIN', 'DELETE'), true);
    assert.strictEqual(rbac.can('USER', 'DELETE'), false);
    assert.strictEqual(rbac.can('USER', 'READ'), true);
  });
});
