import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PostgresBloatAnalyzerService {
  constructor(threshold = 0.2) { this.threshold = threshold; }
  evaluateTable(name, live, dead) {
    const total = live + dead;
    const ratio = total > 0 ? dead / total : 0;
    return { tableName: name, bloatRatio: Math.round(ratio * 100) / 100, defragRecommended: ratio >= this.threshold };
  }
}

describe('PostgresBloatAnalyzerService (Issue #1820)', () => {
  it('should detect dead tuple bloat exceeding autovacuum threshold', () => {
    const analyzer = new PostgresBloatAnalyzerService(0.25);
    const healthy = analyzer.evaluateTable('submissions', 900, 100);
    assert.equal(healthy.defragRecommended, false);

    const bloated = analyzer.evaluateTable('submissions', 700, 300);
    assert.equal(bloated.defragRecommended, true);
  });
});
