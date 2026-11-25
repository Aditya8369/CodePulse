import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AuditHybridSearchEngineService {
  search(logs, term, tag) {
    const t = term.toLowerCase();
    return logs.filter(l => {
      const matchK = l.act.toLowerCase().includes(t) || l.det.toLowerCase().includes(t);
      const matchT = !tag || l.tags.includes(tag);
      return matchK && matchT;
    });
  }
}

describe('AuditHybridSearchEngineService (#2404)', () => {
  test('executes hybrid full-text and tag-filtered searches over audit log entries', () => {
    const engine = new AuditHybridSearchEngineService();
    const logs = [
      { id: '1', act: 'USER_LOGIN', det: 'IP: 1.1.1.1', tags: ['auth', 'sec'] },
      { id: '2', act: 'ROLE_REVOKE', det: 'Admin revoked role', tags: ['rbac', 'sec'] },
      { id: '3', act: 'FILE_EXPORT', det: 'Exported billing data', tags: ['export'] }
    ];

    const results = engine.search(logs, 'revoked', 'sec');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, '2');
  });
});
