import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class S3TenantPolicyAssumerService {
  policy(bucket, tenant) {
    return {
      Resource: `arn:aws:s3:::${bucket}/tenants/${tenant}/*`
    };
  }
}

describe('S3TenantPolicyAssumerService (#2395)', () => {
  test('generates strictly bounded S3 bucket prefix policies per tenant', () => {
    const assumer = new S3TenantPolicyAssumerService();
    const p = assumer.policy('codepulse-storage', 'tenant-zeta');
    assert.strictEqual(p.Resource, 'arn:aws:s3:::codepulse-storage/tenants/tenant-zeta/*');
  });
});
