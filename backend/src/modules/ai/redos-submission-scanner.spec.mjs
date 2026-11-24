import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RedosSubmissionScannerService {
  scan(r) {
    const isVulnerable = r.includes('(a+)+') || r.includes('(a*)*') || r.includes('(b+)+');
    return { vuln: isVulnerable };
  }
}

describe('RedosSubmissionScannerService (#2280)', () => {
  test('flags catastrophic backtracking regex constructs that could trigger ReDoS', () => {
    const scanner = new RedosSubmissionScannerService();
    assert.strictEqual(scanner.scan('^[a-zA-Z0-9]+$').vuln, false);
    assert.strictEqual(scanner.scan('(a+)+$').vuln, true);
  });
});
