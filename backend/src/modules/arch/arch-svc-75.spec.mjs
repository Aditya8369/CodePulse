import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AggregateBranchMergerService } from './arch-svc-75.service.ts';

describe('AggregateBranchMergerService (ARCH-SVC-75)', () => {
  it('merges speculative events onto main aggregate timeline with sequential versioning', () => {
    const merger = new AggregateBranchMergerService();
    const main = [{ id: 'e1', type: 'INIT', version: 1 }];
    const branch = [
      { id: 'e1', type: 'INIT', version: 1 }, // duplicate
      { id: 'e2', type: 'EVAL_STEP', version: 2 }
    ];

    const { merged, conflicts } = merger.mergeBranches(main, branch);
    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[1].version, 2);
    assert.deepStrictEqual(conflicts, ['e1']);
  });
});
