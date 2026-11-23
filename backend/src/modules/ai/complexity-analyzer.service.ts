import { Injectable, Logger } from '@nestjs/common';

export interface HalsteadMetrics {
  distinctOperators: number; // eta1
  distinctOperands: number;  // eta2
  totalOperators: number;    // N1
  totalOperands: number;     // N2
  vocabulary: number;        // eta = eta1 + eta2
  length: number;            // N = N1 + N2
  volume: number;            // V = N * log2(eta)
  difficulty: number;        // D = (eta1 / 2) * (N2 / eta2)
  effort: number;            // E = D * V
  timeSeconds: number;       // T = E / 18
  deliveredBugs: number;     // B = V / 3000
}

export interface FunctionComplexityMetric {
  name: string;
  startLine: number;
  endLine: number;
  linesOfCode: number;
  cyclomaticComplexity: number;
  halstead: HalsteadMetrics;
  maintainabilityIndex: number;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  decisionPointsCount: number;
}

export interface RefactoringAdvice {
  target: string;
  severity: 'WARNING' | 'CRITICAL';
  recommendation: string;
  suggestedPattern: string;
}

export interface CodeComplexityReport {
  overallCyclomaticComplexity: number;
  overallMaintainabilityIndex: number; // 0 - 100
  overallRiskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  linesOfCode: number;
  halstead: HalsteadMetrics;
  functions: FunctionComplexityMetric[];
  hotspotsCount: number;
  refactoringAdvice: RefactoringAdvice[];
  analyzedAt: string;
}

@Injectable()
export class ComplexityAnalyzerService {
  private readonly logger = new Logger(ComplexityAnalyzerService.name);

  // Standard operators recognized by Halstead metric systems
  private readonly OPERATOR_TOKENS = new Set([
    '+', '-', '*', '/', '%', '++', '--',
    '===', '!==', '==', '!=', '<=', '>=', '<', '>',
    '&&', '||', '!', '??',
    '=', '+=', '-=', '*=', '/=', '%=',
    '?', ':', '.', ',', ';',
    '(', ')', '{', '}', '[', ']',
    'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'default', 'break', 'continue',
    'throw', 'try', 'catch', 'finally',
    'let', 'const', 'var', 'new', 'typeof', 'instanceof',
  ]);

  /**
   * Analyzes source code and produces Cyclomatic, Halstead, and Maintainability Index metrics.
   */
  public analyzeCode(sourceCode: string, language = 'typescript'): CodeComplexityReport {
    const lines = sourceCode.split('\n');
    const loc = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('#')).length;

    // 1. Calculate overall Cyclomatic Complexity (CFG decision nodes)
    const { cyclomaticComplexity, decisionPointsCount } = this.calculateCyclomaticComplexity(sourceCode);

    // 2. Calculate overall Halstead Metrics
    const halstead = this.calculateHalsteadMetrics(sourceCode);

    // 3. Compute Maintainability Index (MI)
    const maintainabilityIndex = this.computeMaintainabilityIndex(halstead.volume, cyclomaticComplexity, Math.max(1, loc));

    // 4. Function-level breakdown
    const functions = this.extractAndAnalyzeFunctions(sourceCode);

    // 5. Generate automated refactoring advice for high-risk hotspots
    const refactoringAdvice: RefactoringAdvice[] = [];
    let hotspotsCount = 0;

    if (cyclomaticComplexity > 15) {
      refactoringAdvice.push({
        target: 'Global File Scope',
        severity: 'CRITICAL',
        recommendation: `High overall Cyclomatic Complexity (${cyclomaticComplexity}). Decompose complex conditional flows into isolated modular services.`,
        suggestedPattern: 'Extract Method / Strategy Pattern',
      });
      hotspotsCount++;
    } else if (cyclomaticComplexity > 10) {
      refactoringAdvice.push({
        target: 'Global File Scope',
        severity: 'WARNING',
        recommendation: `Moderate Cyclomatic Complexity (${cyclomaticComplexity}). Replace nested branch logic with early return guard clauses.`,
        suggestedPattern: 'Guard Clauses / Early Returns',
      });
    }

    if (maintainabilityIndex < 65) {
      refactoringAdvice.push({
        target: 'Overall Architecture',
        severity: 'CRITICAL',
        recommendation: `Low Maintainability Index (${maintainabilityIndex}/100). High cognitive load and dense operator/operand volume indicate technical debt.`,
        suggestedPattern: 'Facade / Responsibility Segregation',
      });
      hotspotsCount++;
    }

    for (const fn of functions) {
      if (fn.cyclomaticComplexity > 10) {
        refactoringAdvice.push({
          target: `function '${fn.name}' (line ${fn.startLine})`,
          severity: fn.cyclomaticComplexity > 15 ? 'CRITICAL' : 'WARNING',
          recommendation: `Function '${fn.name}' has CC=${fn.cyclomaticComplexity} exceeding recommended threshold (10). Split into cohesive sub-procedures.`,
          suggestedPattern: 'Extract Method',
        });
        if (fn.riskRating === 'HIGH') hotspotsCount++;
      }
    }

    const overallRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' =
      maintainabilityIndex < 65 || cyclomaticComplexity > 15
        ? 'HIGH'
        : maintainabilityIndex < 85 || cyclomaticComplexity > 10
        ? 'MEDIUM'
        : 'LOW';

    return {
      overallCyclomaticComplexity: cyclomaticComplexity,
      overallMaintainabilityIndex: maintainabilityIndex,
      overallRiskRating,
      linesOfCode: loc,
      halstead,
      functions,
      hotspotsCount,
      refactoringAdvice,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates Cyclomatic Complexity (McCabe CC) = 1 + decision points.
   * Decision points include: if, else if, while, for, case, catch, &&, ||, ??, ternary ? :.
   */
  public calculateCyclomaticComplexity(code: string): { cyclomaticComplexity: number; decisionPointsCount: number } {
    let decisions = 0;

    // Remove comments and strings so literal tokens are not counted as branches
    const cleaned = this.stripCommentsAndStrings(code);

    // Regex matching decision keywords and branch operators
    const branchKeywords = /\b(if|while|for|case|catch)\b/g;
    const branchOperators = /(&&|\|\||\?\?|\?(?![?.]))/g;

    const keywordMatches = cleaned.match(branchKeywords) || [];
    const operatorMatches = cleaned.match(branchOperators) || [];

    decisions = keywordMatches.length + operatorMatches.length;

    return {
      cyclomaticComplexity: 1 + decisions,
      decisionPointsCount: decisions,
    };
  }

  /**
   * Calculates Halstead Metrics (Volume, Difficulty, Effort, Bugs).
   */
  public calculateHalsteadMetrics(code: string): HalsteadMetrics {
    const cleaned = this.stripComments(code);

    // Tokenize into words, numbers, strings, and operators
    const tokenRegex =
      /([a-zA-Z_$][a-zA-Z0-9_$]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\d+(?:\.\d+)?)|(===|!==|==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|\/=|%=|&&|\|\||\?\?|[+\-*\/%&|^~!=<>?:.,;()[\]{}])/g;

    const operators: string[] = [];
    const operands: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(cleaned)) !== null) {
      const [token, identifier, stringLit, numberLit, op] = match;

      if (stringLit || numberLit) {
        operands.push(token);
      } else if (op) {
        operators.push(op);
      } else if (identifier) {
        if (this.OPERATOR_TOKENS.has(identifier)) {
          operators.push(identifier);
        } else {
          operands.push(identifier);
        }
      }
    }

    const distinctOperators = new Set(operators).size;
    const distinctOperands = new Set(operands).size;
    const totalOperators = operators.length;
    const totalOperands = operands.length;

    const vocabulary = distinctOperators + distinctOperands;
    const length = totalOperators + totalOperands;

    // Halstead Volume: V = N * log2(eta)
    const volume = vocabulary > 0 ? Number((length * (Math.log(vocabulary) / Math.LN2)).toFixed(2)) : 0;

    // Halstead Difficulty: D = (eta1 / 2) * (N2 / eta2)
    const difficulty =
      distinctOperands > 0
        ? Number(((distinctOperators / 2) * (totalOperands / distinctOperands)).toFixed(2))
        : 0;

    // Halstead Effort: E = D * V
    const effort = Number((difficulty * volume).toFixed(2));

    // Time required: T = E / 18 seconds
    const timeSeconds = Number((effort / 18).toFixed(2));

    // Estimated delivered bugs: B = V / 3000
    const deliveredBugs = Number((volume / 3000).toFixed(4));

    return {
      distinctOperators,
      distinctOperands,
      totalOperators,
      totalOperands,
      vocabulary,
      length,
      volume,
      difficulty,
      effort,
      timeSeconds,
      deliveredBugs,
    };
  }

  /**
   * Computes Coleman-Oman Maintainability Index (MI) normalized to 0 - 100.
   * Standard formula: MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
   */
  public computeMaintainabilityIndex(volume: number, cyclomaticComplexity: number, loc: number): number {
    const safeVolume = Math.max(1, volume);
    const safeLoc = Math.max(1, loc);

    const rawMi =
      171 -
      5.2 * Math.log(safeVolume) -
      0.23 * cyclomaticComplexity -
      16.2 * Math.log(safeLoc);

    // Normalize from standard [0, 171] range to [0, 100]
    const normalized = Math.max(0, Math.min(100, Math.round((rawMi * 100) / 171)));
    return normalized;
  }

  /**
   * Extracts function blocks and analyzes individual function complexity.
   */
  private extractAndAnalyzeFunctions(sourceCode: string): FunctionComplexityMetric[] {
    const lines = sourceCode.split('\n');
    const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|def\s+([a-zA-Z0-9_$]+))/;

    const functions: FunctionComplexityMetric[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = fnRegex.exec(line);
      if (match) {
        const fnName = match[1] || match[2] || match[3] || 'anonymous';
        // Scan forward to approximate function end
        let endLine = i + 1;
        let depth = 0;
        let foundBrace = false;

        for (let j = i; j < lines.length; j++) {
          const l = lines[j];
          for (const ch of l) {
            if (ch === '{') {
              depth++;
              foundBrace = true;
            } else if (ch === '}') {
              depth--;
            }
          }
          if (foundBrace && depth === 0) {
            endLine = j + 1;
            break;
          }
        }

        const fnSnippet = lines.slice(i, endLine).join('\n');
        const fnLoc = endLine - i;
        const { cyclomaticComplexity, decisionPointsCount } = this.calculateCyclomaticComplexity(fnSnippet);
        const halstead = this.calculateHalsteadMetrics(fnSnippet);
        const mi = this.computeMaintainabilityIndex(halstead.volume, cyclomaticComplexity, fnLoc);

        const riskRating: 'LOW' | 'MEDIUM' | 'HIGH' =
          mi < 65 || cyclomaticComplexity > 15 ? 'HIGH' : mi < 85 || cyclomaticComplexity > 10 ? 'MEDIUM' : 'LOW';

        functions.push({
          name: fnName,
          startLine: i + 1,
          endLine,
          linesOfCode: fnLoc,
          cyclomaticComplexity,
          halstead,
          maintainabilityIndex: mi,
          riskRating,
          decisionPointsCount,
        });
      }
    }

    return functions;
  }

  private stripCommentsAndStrings(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/#.*$/gm, '')
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/`(?:\\.|[^`\\])*`/g, '``');
  }

  private stripComments(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/#.*$/gm, '');
  }
}
