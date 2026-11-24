import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AstEvalInjectionScannerService {
  scan(code) {
    const dangerous = ['eval(', 'child_process', 'Function('];
    const flagged = dangerous.filter(p => code.includes(p));
    return { safe: flagged.length === 0 };
  }
}

describe('AstEvalInjectionScannerService (#2167)', () => {
  test('flags dynamic code evaluation and command injection in user-submitted code', () => {
    const scanner = new AstEvalInjectionScannerService();
    assert.strictEqual(scanner.scan('const x = 10;').safe, true);
    assert.strictEqual(scanner.scan('eval("malicious()")').safe, false);
  });
});
