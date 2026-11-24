export interface MigrationRuleViolation {
  rule: string;
  line: string;
  severity: 'CRITICAL' | 'WARNING';
}

export class MigrationSafetyLinterService {
  public lintMigrationSql(sql: string): MigrationRuleViolation[] {
    const violations: MigrationRuleViolation[] = [];
    const lines = sql.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (lower.startsWith('--') || lower === '') continue;

      if (lower.includes('drop table')) {
        violations.push({ rule: 'NO_DROP_TABLE', line, severity: 'CRITICAL' });
      }
      if (lower.includes('drop column')) {
        violations.push({ rule: 'NO_DROP_COLUMN', line, severity: 'CRITICAL' });
      }
      if (lower.includes('add column') && lower.includes('not null') && !lower.includes('default')) {
        violations.push({ rule: 'NOT_NULL_WITHOUT_DEFAULT', line, severity: 'CRITICAL' });
      }
    }

    return violations;
  }
}
