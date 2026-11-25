import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MultiTenantSchemaIsolationProxyService } from './arch-svc-22.service.ts';

describe('MultiTenantSchemaIsolationProxyService (ARCH-SVC-22)', () => {
  it('registers tenants and sets schema search_path cleanly', () => {
    const proxy = new MultiTenantSchemaIsolationProxyService(5);
    proxy.registerTenant('corp_a', 'schema_corp_a');

    const res = proxy.getScopedQuery('corp_a', 'SELECT * FROM users');
    assert.strictEqual(res.schema, 'schema_corp_a');
    assert.strictEqual(res.scopedSql, 'SET search_path TO schema_corp_a; SELECT * FROM users');
  });

  it('rejects malicious SQL schema identifiers', () => {
    const proxy = new MultiTenantSchemaIsolationProxyService(5);
    assert.throws(() => {
      proxy.registerTenant('malicious', 'public; DROP TABLE users; --');
    }, /Invalid schema name identifier/);
  });

  it('enforces connection pool quotas per tenant', () => {
    const proxy = new MultiTenantSchemaIsolationProxyService(2);
    proxy.registerTenant('tenant_1', 'schema_t1');

    assert.strictEqual(proxy.acquireConnection('tenant_1'), true);
    assert.strictEqual(proxy.acquireConnection('tenant_1'), true);
    assert.strictEqual(proxy.acquireConnection('tenant_1'), false);

    proxy.releaseConnection('tenant_1');
    assert.strictEqual(proxy.acquireConnection('tenant_1'), true);
  });
});
