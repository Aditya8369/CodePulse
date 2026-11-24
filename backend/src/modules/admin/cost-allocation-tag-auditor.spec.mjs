import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CostAllocationTagAuditorService {
  constructor() { this.req = ['Environment', 'CostCenter', 'Owner']; }
  audit(resId, tags) {
    const missing = this.req.filter(r => !tags[r]);
    return { ok: missing.length === 0, missing };
  }
}

describe('CostAllocationTagAuditorService (#2390)', () => {
  test('flags untagged cloud infrastructure resources for FinOps compliance', () => {
    const auditor = new CostAllocationTagAuditorService();
    const valid = auditor.audit('pod-1', { Environment: 'prod', CostCenter: 'eng', Owner: 'dev-team' });
    assert.strictEqual(valid.ok, true);

    const invalid = auditor.audit('pod-2', { Environment: 'prod' });
    assert.strictEqual(invalid.ok, false);
    assert.deepStrictEqual(invalid.missing, ['CostCenter', 'Owner']);
  });
});
