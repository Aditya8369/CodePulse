/**
 * Architecture Service 91: GraphQL Query Complexity & Depth Limit Analyzer
 * Subsystem: API Denial of Service Prevention
 */

export interface QueryAnalysis {
  complexity: number;
  depth: number;
  allowed: boolean;
  reason?: string;
}

export class GraphqlComplexityAnalyzerService {
  private readonly maxComplexity: number;
  private readonly maxDepth: number;

  constructor(maxComplexity = 100, maxDepth = 10) {
    this.maxComplexity = maxComplexity;
    this.maxDepth = maxDepth;
  }

  public analyzeQueryString(queryString: string): QueryAnalysis {
    let currentDepth = 0;
    let maxObservedDepth = 0;
    let fieldCount = 0;

    for (let i = 0; i < queryString.length; i++) {
      const char = queryString[i];
      if (char === '{') {
        currentDepth++;
        if (currentDepth > maxObservedDepth) maxObservedDepth = currentDepth;
      } else if (char === '}') {
        if (currentDepth > 0) currentDepth--;
      }
    }

    // Estimate complexity based on word tokens
    const tokens = queryString.split(/[^a-zA-Z0-9_]+/).filter(t => t.length > 0 && t !== 'query');
    fieldCount = tokens.length;

    if (maxObservedDepth > this.maxDepth) {
      return { complexity: fieldCount, depth: maxObservedDepth, allowed: false, reason: 'QUERY_DEPTH_EXCEEDED' };
    }
    if (fieldCount > this.maxComplexity) {
      return { complexity: fieldCount, depth: maxObservedDepth, allowed: false, reason: 'QUERY_COMPLEXITY_EXCEEDED' };
    }

    return { complexity: fieldCount, depth: maxObservedDepth, allowed: true };
  }
}
