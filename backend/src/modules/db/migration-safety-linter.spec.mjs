import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MigrationSafetyLinterService {
  lintMigrationSql(sql) {
    const violations = [];
    for (const l of sql.split('\n')) {
      const low = l.toLowerCase().trim();
      if (low.includes('drop column')) violations.push({ rule: 'NO_DROP_COLUMN' });
      if (low.includes('add column') && low.includes('not null') && !low.includes('default')) {
        violations.push({ rule: 'NOT_NULL_WITHOUT_DEFAULT' });
      }
    }
    return violations;
  }
}

describe('MigrationSafetyLinterService (Issue #1834)', () => {
  it('should catch destructive schema migrations including dropped columns and NOT NULL without defaults', () => {
    const linter = new MigrationSafetyLinterService();
    const badSql = `
      ALTER TABLE users DROP COLUMN phone;
      ALTER TABLE users ADD COLUMN age INT NOT NULL;
    `;
    const issues = linter.lintMigrationSql(badSql);
    assert.equal(issues.length, 2);
    assert.equal(issues[0].rule, 'NO_DROP_COLUMN');
    assert.equal(issues[1].rule, 'NOT_NULL_WITHOUT_DEFAULT');
  });
});
