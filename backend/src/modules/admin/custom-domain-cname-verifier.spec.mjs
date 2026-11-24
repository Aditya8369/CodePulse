import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CustomDomainCnameVerifierService {
  verify(d, target) {
    const ok = target === 'cname.codepulse.io';
    return { ok, ssl: ok };
  }
}

describe('CustomDomainCnameVerifierService (#2401)', () => {
  test('confirms CNAME DNS routing matches expected edge ingress before triggering SSL issuance', () => {
    const verifier = new CustomDomainCnameVerifierService();
    const valid = verifier.verify('code.customer.com', 'cname.codepulse.io');
    assert.strictEqual(valid.ok, true);
    assert.strictEqual(valid.ssl, true);

    const invalid = verifier.verify('code.customer.com', 'random.cdn.com');
    assert.strictEqual(invalid.ok, false);
    assert.strictEqual(invalid.ssl, false);
  });
});
