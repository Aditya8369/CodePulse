import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CrossTenantSchemaGuardService {
  sanitize(conn) {
    if (conn.currentSchema !== 'public') {
      conn.currentSchema = 'public';
      return { reset: true, currentSchema: 'public' };
    }
    return { reset: false, currentSchema: conn.currentSchema };
  }
}

describe('CrossTenantSchemaGuardService (#2376)', () => {
  test('strictly resets connection schema to public on pool return', () => {
    const guard = new CrossTenantSchemaGuardService();
    const leakedConn = { currentSchema: 'tenant_acme_corp' };

    const res = guard.sanitize(leakedConn);
    assert.strictEqual(res.reset, true);
    assert.strictEqual(leakedConn.currentSchema, 'public');

    const cleanConn = { currentSchema: 'public' };
    assert.strictEqual(guard.sanitize(cleanConn).reset, false);
  });
});
