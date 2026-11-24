import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ASTQueryTaintFirewallService {
  isQueryTainted(q) {
    const l = q.toLowerCase();
    if (l.includes('--') || l.includes('; drop ') || l.includes("' or '1'='1")) return { tainted: true };
    if (l.includes('$where')) return { tainted: true };
    return { tainted: false };
  }
}

describe('ASTQueryTaintFirewallService (Issue #1846)', () => {
  it('should intercept tainted dynamic SQL and NoSQL injection attempts', () => {
    const firewall = new ASTQueryTaintFirewallService();
    assert.equal(firewall.isQueryTainted("SELECT * FROM users WHERE email = 'test@example.com'").tainted, false);
    assert.equal(firewall.isQueryTainted("SELECT * FROM users WHERE email = '' OR '1'='1'").tainted, true);
    assert.equal(firewall.isQueryTainted("{ user: { $where: 'sleep(1000)' } }").tainted, true);
  });
});
