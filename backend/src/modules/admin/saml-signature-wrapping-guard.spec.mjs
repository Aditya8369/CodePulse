import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SamlSignatureWrappingGuardService {
  validate(xml) {
    const matches = xml.match(/<([a-zA-Z0-9]+:)?Assertion/g);
    if (matches && matches.length > 1) return { ok: false, err: 'XSW_MULTIPLE_ASSERTIONS' };
    if (!xml.includes('<Signature')) return { ok: false, err: 'MISSING_SIG' };
    return { ok: true };
  }
}

describe('SamlSignatureWrappingGuardService (#2383)', () => {
  test('flags XML signature wrapping attacks injected into SAML responses', () => {
    const guard = new SamlSignatureWrappingGuardService();
    const clean = '<samlp:Response><Assertion ID="1"/><Signature/></samlp:Response>';
    assert.strictEqual(guard.validate(clean).ok, true);

    const xswAttack = '<samlp:Response><Assertion ID="1"/><Signature/><Assertion ID="tampered"/></samlp:Response>';
    assert.strictEqual(guard.validate(xswAttack).ok, false);
    assert.strictEqual(guard.validate(xswAttack).err, 'XSW_MULTIPLE_ASSERTIONS');
  });
});
