import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DomainBoundaryComplianceLinterService } from './arch-svc-90.service.ts';

describe('DomainBoundaryComplianceLinterService (ARCH-SVC-90)', () => {
  it('detects cyclic import dependencies across domain modules', () => {
    const linter = new DomainBoundaryComplianceLinterService();
    const cyclicGraph = {
      'auth': ['users'],
      'users': ['billing'],
      'billing': ['auth']
    };
    assert.strictEqual(linter.detectCyclicDependencies(cyclicGraph).hasCycle, true);

    const acyclicGraph = {
      'auth': ['users'],
      'users': ['billing'],
      'billing': []
    };
    assert.strictEqual(linter.detectCyclicDependencies(acyclicGraph).hasCycle, false);
  });
});
