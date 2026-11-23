import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExplainPlanNode,
  PartialIndexRecommendation,
  PgStatAnalyzer,
  PgStatStatement,
} from './pg-stat-analyzer';

@Injectable()
export class IndexAdvisorService {
  private readonly logger = new Logger(IndexAdvisorService.name);
  private readonly analyzer = new PgStatAnalyzer();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Analyzes active query workload or provided pg_stat_statements to find unindexed queries
   * and synthesize optimal partial / composite index recommendations.
   */
  async analyzeQueryWorkload(
    statements?: PgStatStatement[],
  ): Promise<PartialIndexRecommendation[]> {
    const list = statements || (await this.fetchTopSlowStatements());
    const recommendations: PartialIndexRecommendation[] = [];
    const seenIndexes = new Set<string>();

    for (const stmt of list) {
      // Look for queries with table scans or filters on large tables
      const plan = await this.explainQuery(stmt.query);
      const planNodes = this.analyzer.parseExplainTree(plan);

      for (const node of planNodes) {
        if (node.nodeType === 'Seq Scan' && node.relationName && node.filter) {
          const { columns, partialPredicate } = this.analyzer.extractFilterPredicates(node.filter);

          if (columns.length > 0) {
            const rec = this.analyzer.synthesizeIndex(
              node.relationName,
              columns,
              partialPredicate,
              node.totalCost,
            );

            if (!seenIndexes.has(rec.indexName)) {
              seenIndexes.add(rec.indexName);
              recommendations.push(rec);
            }
          }
        }
      }
    }

    this.logger.log(
      `Analyzed ${list.length} queries. Generated ${recommendations.length} index recommendations.`,
    );

    return recommendations;
  }

  /**
   * Fetches top queries by total execution time from pg_stat_statements.
   */
  async fetchTopSlowStatements(limit = 20): Promise<PgStatStatement[]> {
    if (!this.prisma) {
      // Mock workload for testing / standalone mode
      return [
        {
          queryId: 'q-101',
          query: "SELECT * FROM battles WHERE status = 'ACTIVE' AND challenger_id = $1",
          calls: 15400,
          totalExecTimeMs: 42000,
          meanExecTimeMs: 2.7,
          rows: 15400,
          sharedBlksRead: 4500,
          sharedBlksHit: 98000,
        },
        {
          queryId: 'q-102',
          query: 'SELECT * FROM repositories WHERE user_id = $1 AND stars > 100',
          calls: 8200,
          totalExecTimeMs: 19800,
          meanExecTimeMs: 2.4,
          rows: 8200,
          sharedBlksRead: 2100,
          sharedBlksHit: 44000,
        },
      ];
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<PgStatStatement[]>(`
        SELECT
          queryid::text as "queryId",
          query,
          calls,
          total_exec_time as "totalExecTimeMs",
          mean_exec_time as "meanExecTimeMs",
          rows,
          shared_blks_read as "sharedBlksRead",
          shared_blks_hit as "sharedBlksHit"
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
        ORDER BY total_exec_time DESC
        LIMIT ${limit};
      `);
      return rows;
    } catch {
      this.logger.warn('pg_stat_statements extension not available. Returning empty query set.');
      return [];
    }
  }

  /**
   * Simulates or executes EXPLAIN (FORMAT JSON) on a query.
   */
  async explainQuery(query: string): Promise<unknown> {
    if (!this.prisma) {
      // Return simulated plan based on query structure
      if (query.includes('battles')) {
        return [
          {
            Plan: {
              'Node Type': 'Seq Scan',
              'Relation Name': 'battles',
              Filter: "(status = 'ACTIVE'::text AND challenger_id = 'user-1'::text)",
              'Startup Cost': 0.0,
              'Total Cost': 1845.5,
              'Plan Rows': 42,
            },
          },
        ];
      }
      if (query.includes('repositories')) {
        return [
          {
            Plan: {
              'Node Type': 'Seq Scan',
              'Relation Name': 'repositories',
              Filter: '(user_id = $1 AND stars > 100)',
              'Startup Cost': 0.0,
              'Total Cost': 920.0,
              'Plan Rows': 18,
            },
          },
        ];
      }
      return [];
    }

    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': unknown }>>(
        `EXPLAIN (FORMAT JSON) ${query}`,
      );
      return result[0]?.['QUERY PLAN'] || [];
    } catch {
      return [];
    }
  }

  /**
   * Generates a complete human-reviewable PostgreSQL migration file content.
   */
  generateMigrationSql(recommendations: PartialIndexRecommendation[]): string {
    const lines = [
      '-- Autonomous Index Advisor Generated Migration',
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Total recommended indexes: ${recommendations.length}`,
      '',
    ];

    for (const rec of recommendations) {
      lines.push(`-- Reason: ${rec.reason}`);
      lines.push(`-- Estimated Speedup: ~${rec.estimatedSpeedupPct}% | Estimated Disk Cost: ${rec.estimatedDiskCostMb}MB`);
      lines.push(rec.sqlStatement);
      lines.push('');
    }

    return lines.join('\n');
  }
}
