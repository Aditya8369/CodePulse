import { IndexAdvisorService } from './index-advisor.service';
import { PgStatAnalyzer } from './pg-stat-analyzer';

describe('IndexAdvisorService & PgStatAnalyzer (Autonomous Execution Plan Analyzer)', () => {
  let advisor: IndexAdvisorService;
  let analyzer: PgStatAnalyzer;

  beforeEach(() => {
    analyzer = new PgStatAnalyzer();
    advisor = new IndexAdvisorService();
  });

  it('parses complex PostgreSQL EXPLAIN plan trees with nested nodes', () => {
    const complexPlan = [
      {
        Plan: {
          'Node Type': 'Hash Join',
          'Startup Cost': 120.0,
          'Total Cost': 3500.0,
          'Plan Rows': 500,
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'battles',
              Filter: "(status = 'ACTIVE'::text AND category = 'ALGORITHMS'::text)",
              'Startup Cost': 0.0,
              'Total Cost': 1800.0,
              'Plan Rows': 250,
            },
            {
              'Node Type': 'Index Scan',
              'Relation Name': 'users',
              'Index Cond': '(id = battles.challenger_id)',
              'Startup Cost': 0.42,
              'Total Cost': 8.5,
              'Plan Rows': 1,
            },
          ],
        },
      },
    ];

    const nodes = analyzer.parseExplainTree(complexPlan);
    expect(nodes).toHaveLength(3); // Hash Join, Seq Scan, Index Scan

    const seqScan = nodes.find((n) => n.nodeType === 'Seq Scan');
    expect(seqScan).toBeDefined();
    expect(seqScan?.relationName).toBe('battles');
  });

  it('extracts filter predicates and identifies partial index opportunities', () => {
    const filter = "(status = 'ACTIVE'::text AND user_id = 'user-123'::text AND stars > 50)";
    const extracted = analyzer.extractFilterPredicates(filter);

    expect(extracted.partialPredicate).toBe("status = 'ACTIVE'");
    expect(extracted.columns).toContain('status');
    expect(extracted.columns).toContain('user_id');
    expect(extracted.columns).toContain('stars');
  });

  it('synthesizes optimal CREATE INDEX CONCURRENTLY with partial predicates', () => {
    const rec = analyzer.synthesizeIndex(
      'battles',
      ['challenger_id', 'created_at'],
      "status = 'ACTIVE'",
      2500,
    );

    expect(rec.indexName).toContain('idx_battles_challenger_id_created_at_partial');
    expect(rec.sqlStatement).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
    expect(rec.sqlStatement).toContain("WHERE status = 'ACTIVE'");
    expect(rec.estimatedSpeedupPct).toBeGreaterThanOrEqual(70);
    expect(rec.estimatedDiskCostMb).toBeLessThan(20);
  });

  it('analyzes query workload and generates human-reviewable migration SQL', async () => {
    const recommendations = await advisor.analyzeQueryWorkload();
    expect(recommendations.length).toBeGreaterThanOrEqual(2);

    const battlesRec = recommendations.find((r) => r.tableName === 'battles');
    expect(battlesRec).toBeDefined();
    expect(battlesRec?.predicate).toBe("status = 'ACTIVE'");

    const migrationSql = advisor.generateMigrationSql(recommendations);
    expect(migrationSql).toContain('-- Autonomous Index Advisor Generated Migration');
    expect(migrationSql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
  });
});
