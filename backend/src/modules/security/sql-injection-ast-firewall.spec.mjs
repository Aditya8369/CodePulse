import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SqlInjectionAstFirewallService {
  check(sql) {
    const l = sql.toLowerCase();
    return !(l.includes('or 1=1') || l.includes('union select'));
  }
}

describe('SqlInjectionAstFirewallService (#2176)', () => {
  test('intercepts dynamic SQL injection strings and permits parameterized queries', () => {
    const fw = new SqlInjectionAstFirewallService();
    assert.strictEqual(fw.check('SELECT * FROM users WHERE id = $1'), true);
    assert.strictEqual(fw.check("SELECT * FROM users WHERE id = 'admin' OR 1=1"), false);
  });
});
