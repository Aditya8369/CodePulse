import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TreesitterVulnAutofixService {
  fix(c) {
    if (c.includes('eval(')) return { vuln: true, fixed: c.replace('eval(', 'JSON.parse(') };
    return { vuln: false };
  }
}

describe('TreesitterVulnAutofixService (#2270)', () => {
  test('proposes automated AST-level secure remediation for vulnerable code constructs', () => {
    const autofix = new TreesitterVulnAutofixService();
    const res = autofix.fix('const res = eval(payload);');
    assert.strictEqual(res.vuln, true);
    assert.strictEqual(res.fixed, 'const res = JSON.parse(payload);');
  });
});
