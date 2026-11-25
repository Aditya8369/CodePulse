/**
 * Architecture Service: Developer PR Code Complexity Rating Bot
 * Subsystem: Advanced Observability & Developer Experience [OBS-DX-25]
 */

export interface FunctionComplexity {
  name: string;
  score: number;
  rating: 'LOW' | 'MODERATE' | 'HIGH';
  reasons: string[];
}

export interface ComplexityAnalysisResult {
  functions: FunctionComplexity[];
  maxScore: number;
  averageScore: number;
  requiresRefactoring: boolean;
}

export class PrComplexityRatingBotService {
  public calculateCognitiveComplexity(functionCode: string): FunctionComplexity {
    let score = 0;
    const reasons: string[] = [];
    const lines = functionCode.split('\n');

    let currentNesting = 0;
    const funcMatch = functionCode.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\()/);
    const functionName = funcMatch ? (funcMatch[1] || funcMatch[2]) : 'anonymousFunction';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Check opening/closing braces for nesting tracking
      if (line.includes('{')) currentNesting++;
      if (line.includes('}')) currentNesting = Math.max(0, currentNesting - 1);

      // Incrementors: if, else if, while, for, catch, switch, ternary
      if (/\b(if|else\s+if|while|for|catch)\b/.test(line)) {
        const nestingWeight = Math.max(1, currentNesting);
        score += nestingWeight;
        reasons.push('Control structure (' + line.split('(')[0].trim() + ') at nesting level ' + currentNesting + ' (+' + nestingWeight + ')');
      }

      // Logical operator chaining increments (&&, ||)
      const logicals = (line.match(/(&&|\|\|)/g) || []).length;
      if (logicals > 0) {
        score += logicals;
        reasons.push('Logical operator chaining (+' + logicals + ')');
      }
    }

    let rating: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (score > 15) rating = 'HIGH';
    else if (score > 5) rating = 'MODERATE';

    return {
      name: functionName,
      score,
      rating,
      reasons
    };
  }

  public analyzeCodeDiff(fileContent: string): ComplexityAnalysisResult {
    // Basic extraction of function blocks
    const functionBlocks = fileContent.split(/(?=function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()/);
    const functions: FunctionComplexity[] = [];

    for (const block of functionBlocks) {
      if (block.trim().length > 10 && (block.includes('function') || block.includes('=>'))) {
        functions.push(this.calculateCognitiveComplexity(block));
      }
    }

    if (functions.length === 0) {
      return {
        functions: [],
        maxScore: 0,
        averageScore: 0,
        requiresRefactoring: false
      };
    }

    const maxScore = Math.max(...functions.map(f => f.score));
    const averageScore = Math.round(functions.reduce((acc, f) => acc + f.score, 0) / functions.length);
    const requiresRefactoring = functions.some(f => f.rating === 'HIGH');

    return {
      functions,
      maxScore,
      averageScore,
      requiresRefactoring
    };
  }

  public generateReviewComment(result: ComplexityAnalysisResult): string {
    if (result.functions.length === 0) {
      return '### Code Complexity Analysis\nNo functions identified in change set.';
    }

    let md = '### PR Code Cognitive Complexity Report\n\n';
    md += '| Function Name | Cognitive Complexity | Rating | Recommendation |\n';
    md += '|---|---|---|---|\n';

    for (const f of result.functions) {
      const rec = f.rating === 'HIGH' ? '⚠️ High cognitive load; extract helper functions' : f.rating === 'MODERATE' ? 'ℹ️ Acceptable complexity' : '✅ Clean & readable';
      md += '| `' + f.name + '` | ' + f.score + ' | ' + f.rating + ' | ' + rec + ' |\n';
    }

    return md;
  }
}
