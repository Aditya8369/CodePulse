import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SlowQueryAdvisorService {
  constructor(slowThresholdMs = 100) {
    this.slowThresholdMs = slowThresholdMs;
  }

  analyzeQueryPlan(sql, durationMs, planJson) {
    const rootNode = Array.isArray(planJson) ? planJson[0]?.Plan : planJson?.Plan;
    const recommendations = [];
    let hasSeqScan = false;
    let highCost = false;

    if (!rootNode) return { hasSeqScan: false, highCost: false, recommendations: [] };

    const traverse = (node) => {
      if (node['Node Type'] === 'Seq Scan') {
        hasSeqScan = true;
        const rel = node['Relation Name'] || 'table';
        recommendations.push(`Sequential scan on ${rel}. Add index.`);
      }
      if (node['Total Cost'] > 1000) highCost = true;
      if (node.Plans) node.Plans.forEach(traverse);
    };
    traverse(rootNode);

    if (durationMs > this.slowThresholdMs) recommendations.push('Slow query exceeded threshold');

    return { hasSeqScan, highCost, recommendations };
  }
}

describe('SlowQueryAdvisorService (Issue #1470)', () => {
  it('should detect Seq Scan and recommend creating an index', () => {
    const advisor = new SlowQueryAdvisorService(50);
    const mockPlan = [{
      Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'match_history',
        'Total Cost': 1500,
        'Filter': '(user_id = 42)'
      }
    }];

    const advice = advisor.analyzeQueryPlan('SELECT * FROM match_history WHERE user_id = 42', 120, mockPlan);
    assert.equal(advice.hasSeqScan, true);
    assert.equal(advice.highCost, true);
    assert.ok(advice.recommendations.some(r => r.includes('Sequential scan on match_history')));
  });

  it('should pass index scan queries without sequential scan warnings', () => {
    const advisor = new SlowQueryAdvisorService(100);
    const mockPlan = [{
      Plan: {
        'Node Type': 'Index Scan',
        'Relation Name': 'users',
        'Total Cost': 8.5
      }
    }];

    const advice = advisor.analyzeQueryPlan('SELECT * FROM users WHERE id = 1', 12, mockPlan);
    assert.equal(advice.hasSeqScan, false);
    assert.equal(advice.highCost, false);
    assert.equal(advice.recommendations.length, 0);
  });
});
