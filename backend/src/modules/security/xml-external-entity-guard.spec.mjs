import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class XmlExternalEntityGuardService {
  check(xml) {
    const l = xml.toLowerCase();
    return !(l.includes('<!doctype') || l.includes('<!entity'));
  }
}

describe('XmlExternalEntityGuardService (#2189)', () => {
  test('rejects XML payloads containing external DTD entity declarations', () => {
    const guard = new XmlExternalEntityGuardService();
    assert.strictEqual(guard.check('<saml:Response>Valid</saml:Response>'), true);
    assert.strictEqual(guard.check('<!DOCTYPE test [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>'), false);
  });
});
