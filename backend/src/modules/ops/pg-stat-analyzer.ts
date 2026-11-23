export interface PgStatStatement {
  queryId: string;
  query: string;
  calls: number;
  totalExecTimeMs: number;
  meanExecTimeMs: number;
  rows: number;
  sharedBlksRead: number;
  sharedBlksHit: number;
}

export interface ExplainPlanNode {
  nodeType: string;
  relationName?: string;
  filter?: string;
  indexCond?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  plans?: ExplainPlanNode[];
}

export interface PartialIndexRecommendation {
  tableName: string;
  indexName: string;
  columns: string[];
  predicate?: string;
  sqlStatement: string;
  estimatedSpeedupPct: number;
  estimatedDiskCostMb: number;
  reason: string;
}

export class PgStatAnalyzer {
  /**
   * Recursively parses an EXPLAIN (FORMAT JSON) plan tree and flattens all nodes.
   */
  parseExplainTree(planJson: unknown): ExplainPlanNode[] {
    const nodes: ExplainPlanNode[] = [];

    const walk = (node: Record<string, unknown>) => {
      const planNode: ExplainPlanNode = {
        nodeType: String(node['Node Type'] || node['nodeType'] || 'Unknown'),
        relationName: node['Relation Name'] ? String(node['Relation Name']) : undefined,
        filter: node['Filter'] ? String(node['Filter']) : undefined,
        indexCond: node['Index Cond'] ? String(node['Index Cond']) : undefined,
        startupCost: Number(node['Startup Cost'] || node['startupCost'] || 0),
        totalCost: Number(node['Total Cost'] || node['totalCost'] || 0),
        planRows: Number(node['Plan Rows'] || node['planRows'] || 0),
        plans: [],
      };

      nodes.push(planNode);

      const subPlans = (node['Plans'] || node['plans']) as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(subPlans)) {
        for (const sub of subPlans) {
          walk(sub);
        }
      }
    };

    if (Array.isArray(planJson) && planJson[0]?.Plan) {
      walk(planJson[0].Plan as Record<string, unknown>);
    } else if (planJson && typeof planJson === 'object') {
      const root = (planJson as Record<string, unknown>)['Plan'] || planJson;
      walk(root as Record<string, unknown>);
    }

    return nodes;
  }

  /**
   * Extracts referenced columns and candidate partial index filter predicates
   * from SQL filter expressions like: "(status = 'ACTIVE'::text AND user_id = $1)"
   */
  extractFilterPredicates(filterStr: string): { columns: string[]; partialPredicate?: string } {
    const columns: string[] = [];
    let partialPredicate: string | undefined;

    // Detect status / type partial filter (e.g. status = 'ACTIVE' or status = 'COMPLETED')
    const statusMatch = filterStr.match(/(status\s*=\s*['"][A-Z_]+['"])/i);
    if (statusMatch) {
      partialPredicate = statusMatch[1].replace(/::[a-zA-Z0-9_]+/g, '');
    }

    // Extract identifiers that look like column names
    const cleaned = filterStr.replace(/::[a-zA-Z0-9_]+/g, '');
    const tokens = cleaned.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

    const reservedWords = new Set([
      'and', 'or', 'not', 'null', 'is', 'in', 'text', 'integer',
      'boolean', 'true', 'false', 'now', 'date', 'current_timestamp',
    ]);

    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (!reservedWords.has(lower) && !columns.includes(token)) {
        columns.push(token);
      }
    }

    return { columns, partialPredicate };
  }

  /**
   * Synthesizes an optimal CREATE INDEX CONCURRENTLY recommendation.
   */
  synthesizeIndex(
    tableName: string,
    columns: string[],
    partialPredicate?: string,
    cost = 1000,
  ): PartialIndexRecommendation {
    const colList = columns.slice(0, 3);
    const colSlug = colList.join('_').replace(/[^a-zA-Z0-9_]/g, '');
    const partialSlug = partialPredicate ? '_partial' : '';
    const indexName = `idx_${tableName}_${colSlug}${partialSlug}`;

    const whereClause = partialPredicate ? ` WHERE ${partialPredicate}` : '';
    const sqlStatement = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${tableName}" (${colList.map((c) => `"${c}"`).join(', ')})${whereClause};`;

    // Speedup estimation: Seq scan cost reduction to index lookup (~75% to 92%)
    const speedupPct = Math.min(95, Math.max(65, Math.round(50 + Math.log10(cost + 1) * 15)));
    const estimatedDiskCostMb = partialPredicate ? 14.5 : 42.0;

    return {
      tableName,
      indexName,
      columns: colList,
      predicate: partialPredicate,
      sqlStatement,
      estimatedSpeedupPct: speedupPct,
      estimatedDiskCostMb,
      reason: partialPredicate
        ? `Replaces sequential scan on ${tableName} with partial index saving ~65% index storage overhead.`
        : `Eliminates costly sequential scan on ${tableName} across filtered columns (${colList.join(', ')}).`,
    };
  }
}
