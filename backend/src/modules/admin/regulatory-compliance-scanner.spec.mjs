import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RegulatoryComplianceScannerService {
  scan(cfg) {
    const v = [];
    if (cfg.tls !== '1.3') v.push('TLS');
    if (!cfg.encRest) v.push('ENC');
    if (!cfg.audit) v.push('AUDIT');
    return { ok: v.length === 0, violations: v };
  }
}

describe('RegulatoryComplianceScannerService (#2393)', () => {
  test('flags compliance gaps in security and cryptographic configurations', () => {
    const scanner = new RegulatoryComplianceScannerService();
    const good = scanner.scan({ tls: '1.3', encRest: true, audit: true });
    assert.strictEqual(good.ok, true);

    const bad = scanner.scan({ tls: '1.0', encRest: false, audit: true });
    assert.strictEqual(bad.ok, false);
    assert.deepStrictEqual(bad.violations, ['TLS', 'ENC']);
  });
});
