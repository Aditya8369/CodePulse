export interface ExplainNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Total Cost': number;
  'Plan Rows': number;
  'Filter'?: string;
  Plans?: ExplainNode[];
}

export interface SqlOptimizationAdvice {
  hasSeqScan: boolean;
  highCost: boolean;
  recommendations: string[];
}

export class SlowQueryAdvisorService {
  constructor(private readonly slowThresholdMs = 100) {}

  public analyzeQueryPlan(sql: string, durationMs: number, planJson: any): SqlOptimizationAdvice {
    const rootNode: ExplainNode = Array.isArray(planJson) ? planJson[0]?.Plan : planJson?.Plan;
    const recommendations: string[] = [];
    let hasSeqScan = false;
    let highCost = false;

    if (!rootNode) {
      return { hasSeqScan: false, highCost: false, recommendations: ['No plan provided'] };
    }

    const traverse = (node: ExplainNode) => {
      if (node['Node Type'] === 'Seq Scan') {
        hasSeqScan = true;
        const relation = node['Relation Name'] || 'target_table';
        const filter = node['Filter'] ? ` on ${node['Filter']}` : '';
        recommendations.push(`Sequential scan detected on '${relation}'${filter}. Recommend index: CREATE INDEX idx_${relation}_opt ON ${relation};`);
      }

      if (node['Total Cost'] > 1000) {
        highCost = true;
      }

      if (node.Plans) {
        for (const child of node.Plans) {
          traverse(child);
        }
      }
    };

    traverse(rootNode);

    if (durationMs > this.slowThresholdMs) {
      recommendations.push(`Query duration (${durationMs}ms) exceeds ${this.slowThresholdMs}ms threshold. Consider query refactoring or materialized views.`);
    }

    return {
      hasSeqScan,
      highCost,
      recommendations
    };
  }
}
