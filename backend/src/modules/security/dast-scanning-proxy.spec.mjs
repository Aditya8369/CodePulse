import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DastScanningProxyService {
  scan(route, headers) {
    const f = [];
    if (!headers.authorization) f.push('UNPROTECTED');
    if (route.includes('../')) f.push('PATH_TRAVERSAL');
    return f;
  }
}

describe('DastScanningProxyService (#2186)', () => {
  test('detects path traversal and unprotected API endpoints during dynamic security scans', () => {
    const proxy = new DastScanningProxyService();
    assert.strictEqual(proxy.scan('/api/files/../../etc/passwd', { authorization: 'token' }).includes('PATH_TRAVERSAL'), true);
    assert.strictEqual(proxy.scan('/api/admin/users', {}).includes('UNPROTECTED'), true);
  });
});
