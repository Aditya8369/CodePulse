import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PostMortemReportGeneratorService {
  generateReport(m) {
    return `# Post-Mortem: ${m.id}\nSeverity: ${m.severity}\nRoot Cause: ${m.rootCause}`;
  }
}

describe('PostMortemReportGeneratorService (Issue #1910)', () => {
  it('should compile structured post-mortem Markdown incident summaries', () => {
    const generator = new PostMortemReportGeneratorService();
    const doc = generator.generateReport({
      id: 'INC-2026-001',
      title: 'Database connection exhaustion',
      severity: 'P1',
      durationMinutes: 15,
      rootCause: 'Connection starvation due to slow query on unindexed table'
    });

    assert.ok(doc.includes('INC-2026-001'));
    assert.ok(doc.includes('P1'));
    assert.ok(doc.includes('Connection starvation'));
  });
});
