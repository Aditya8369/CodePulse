import { Injectable, Logger, Optional } from '@nestjs/common';
import * as ts from 'typescript';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HalsteadMetricsDto,
  FunctionComplexityDto,
  FileComplexityDto,
  CodeAnalysisRequestDto,
  BatchFileInputDto,
  RepositoryComplexitySnapshotDto,
} from './dto/complexity.dto';

@Injectable()
export class ComplexityService {
  private readonly logger = new Logger(ComplexityService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Analyzes an isolated code snippet.
   */
  public analyzeCode(request: CodeAnalysisRequestDto): FileComplexityDto {
    const filePath = request.filePath || 'snippet.ts';
    const language = (request.language || this.inferLanguage(filePath)).toLowerCase();
    return this.analyzeFile(filePath, request.code, language);
  }

  /**
   * Analyzes a single source file and returns file-level and function-level complexity metrics.
   */
  public analyzeFile(filePath: string, content: string, language?: string): FileComplexityDto {
    const resolvedLang = (language || this.inferLanguage(filePath)).toLowerCase();

    if (resolvedLang === 'python' || filePath.endsWith('.py')) {
      return this.analyzePythonFile(filePath, content);
    }

    return this.analyzeTypeScriptFile(filePath, content, resolvedLang);
  }

  /**
   * Analyzes a batch of files and aggregates repository-level complexity metrics.
   */
  public analyzeBatch(files: BatchFileInputDto[]): {
    fileMetrics: FileComplexityDto[];
    fileCount: number;
    totalLoc: number;
    averageComplexity: number;
    maxComplexity: number;
    averageMaintainability: number;
    totalHalsteadVolume: number;
    highRiskFunctionsCount: number;
    highRiskFunctions: FunctionComplexityDto[];
  } {
    const fileMetrics: FileComplexityDto[] = [];
    const allHighRiskFunctions: FunctionComplexityDto[] = [];
    let totalLoc = 0;
    let sumComplexity = 0;
    let maxComplexity = 0;
    let sumMaintainability = 0;
    let totalHalsteadVolume = 0;

    for (const f of files) {
      const metric = this.analyzeFile(f.filePath, f.content, f.language);
      fileMetrics.push(metric);
      totalLoc += metric.sourceLinesOfCode;
      sumComplexity += metric.cyclomaticComplexity;
      sumMaintainability += metric.maintainabilityIndex;
      totalHalsteadVolume += metric.halstead.volume;

      for (const fn of metric.functions) {
        if (fn.cyclomaticComplexity > maxComplexity) {
          maxComplexity = fn.cyclomaticComplexity;
        }
        if (fn.isRefactoringCandidate) {
          allHighRiskFunctions.push(fn);
        }
      }
    }

    const fileCount = fileMetrics.length;
    const averageComplexity =
      fileCount > 0 ? parseFloat((sumComplexity / fileCount).toFixed(2)) : 0;
    const averageMaintainability =
      fileCount > 0 ? parseFloat((sumMaintainability / fileCount).toFixed(2)) : 100;

    return {
      fileMetrics,
      fileCount,
      totalLoc,
      averageComplexity,
      maxComplexity,
      averageMaintainability,
      totalHalsteadVolume: parseFloat(totalHalsteadVolume.toFixed(2)),
      highRiskFunctionsCount: allHighRiskFunctions.length,
      highRiskFunctions: allHighRiskFunctions,
    };
  }

  /**
   * Creates and stores a repository complexity snapshot in PostgreSQL via Prisma.
   */
  public async createRepositorySnapshot(
    repositoryId: string,
    repositoryFullName: string,
    files: BatchFileInputDto[],
    branch = 'main',
    commitSha?: string,
  ): Promise<RepositoryComplexitySnapshotDto> {
    const batch = this.analyzeBatch(files);

    const snapshotData: RepositoryComplexitySnapshotDto = {
      repositoryId,
      repositoryFullName,
      branch,
      commitSha,
      fileCount: batch.fileCount,
      totalLoc: batch.totalLoc,
      averageComplexity: batch.averageComplexity,
      maxComplexity: batch.maxComplexity,
      averageMaintainability: batch.averageMaintainability,
      totalHalsteadVolume: batch.totalHalsteadVolume,
      highRiskFunctionsCount: batch.highRiskFunctionsCount,
      fileMetrics: batch.fileMetrics,
      highRiskFunctions: batch.highRiskFunctions,
      createdAt: new Date().toISOString(),
    };

    if (this.prisma) {
      try {
        const saved = await (this.prisma as any).repositoryComplexity?.create({
          data: {
            repositoryId,
            repositoryFullName,
            branch,
            commitSha,
            fileCount: batch.fileCount,
            totalLoc: batch.totalLoc,
            averageComplexity: batch.averageComplexity,
            maxComplexity: batch.maxComplexity,
            averageMaintainability: batch.averageMaintainability,
            totalHalsteadVolume: batch.totalHalsteadVolume,
            highRiskFunctionsCount: batch.highRiskFunctionsCount,
            fileMetrics: batch.fileMetrics as any,
            highRiskFunctions: batch.highRiskFunctions as any,
          },
        });
        if (saved?.id) {
          snapshotData.id = saved.id;
        }
      } catch (err: any) {
        this.logger.warn(`Could not persist repository complexity snapshot: ${err?.message}`);
      }
    }

    return snapshotData;
  }

  /**
   * Retrieves the latest complexity snapshot for a repository.
   */
  public async getLatestSnapshot(
    repositoryId: string,
  ): Promise<RepositoryComplexitySnapshotDto | null> {
    if (!this.prisma) return null;

    try {
      const record = await (this.prisma as any).repositoryComplexity?.findFirst({
        where: { repositoryId },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) return null;

      return {
        id: record.id,
        repositoryId: record.repositoryId,
        repositoryFullName: record.repositoryFullName,
        branch: record.branch,
        commitSha: record.commitSha,
        fileCount: record.fileCount,
        totalLoc: record.totalLoc,
        averageComplexity: record.averageComplexity,
        maxComplexity: record.maxComplexity,
        averageMaintainability: record.averageMaintainability,
        totalHalsteadVolume: record.totalHalsteadVolume,
        highRiskFunctionsCount: record.highRiskFunctionsCount,
        fileMetrics: record.fileMetrics,
        highRiskFunctions: record.highRiskFunctions,
        createdAt: record.createdAt?.toISOString(),
      };
    } catch (err: any) {
      this.logger.warn(`Error fetching latest complexity snapshot: ${err?.message}`);
      return null;
    }
  }

  /**
   * Retrieves high-risk functions and hotspots for a repository.
   */
  public async getHotspots(repositoryId: string): Promise<{
    repositoryId: string;
    highRiskFunctions: FunctionComplexityDto[];
    totalHotspots: number;
    summary: string;
  }> {
    const latest = await this.getLatestSnapshot(repositoryId);
    const hotspots = latest?.highRiskFunctions || [];

    return {
      repositoryId,
      highRiskFunctions: hotspots,
      totalHotspots: hotspots.length,
      summary:
        hotspots.length > 0
          ? `Found ${hotspots.length} high-risk cognitive and cyclomatic complexity hotspots requiring refactoring.`
          : 'Repository adheres to clean architecture with 0 high-risk complexity hotspots.',
    };
  }

  // =========================================================================
  // TypeScript / JavaScript AST Analyzer
  // =========================================================================

  private analyzeTypeScriptFile(
    filePath: string,
    content: string,
    language: string,
  ): FileComplexityDto {
    const lines = content.split('\n');
    const totalLines = lines.length;
    const sourceLinesOfCode = lines.filter(
      (l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('/*'),
    ).length;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );

    // Compute File-Level Halstead Metrics
    const fileOperators = new Map<string, number>();
    const fileOperands = new Map<string, number>();

    // Parse Functions
    const functions: FunctionComplexityDto[] = [];

    const visitForFileHalstead = (node: ts.Node) => {
      this.collectHalsteadTokens(node, fileOperators, fileOperands);
      ts.forEachChild(node, visitForFileHalstead);
    };
    visitForFileHalstead(sourceFile);

    const fileHalstead = this.calculateHalsteadMetrics(fileOperators, fileOperands);

    // Visit AST for Function Scopes
    const visitForFunctions = (node: ts.Node) => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isConstructorDeclaration(node)
      ) {
        const fnName = this.extractFunctionName(node, sourceFile);
        const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const fnLoc = Math.max(1, endLine - startLine + 1);

        // Calculate Function Cyclomatic Complexity
        const fnComplexity = this.computeFunctionCyclomaticComplexity(node);

        // Calculate Function Halstead
        const fnOperators = new Map<string, number>();
        const fnOperands = new Map<string, number>();
        const visitFnHalstead = (child: ts.Node) => {
          this.collectHalsteadTokens(child, fnOperators, fnOperands);
          ts.forEachChild(child, visitFnHalstead);
        };
        visitFnHalstead(node);
        const fnHalstead = this.calculateHalsteadMetrics(fnOperators, fnOperands);

        // Calculate Function Maintainability Index
        const fnMI = this.calculateMaintainabilityIndex(fnHalstead.volume, fnComplexity, fnLoc);

        // Evaluate Risk and Refactoring Suggestions
        const isRefactoringCandidate = fnComplexity > 15 || fnMI < 65;
        const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
          fnComplexity > 15 || fnMI < 65
            ? 'HIGH'
            : fnComplexity >= 10 || fnMI < 75
              ? 'MEDIUM'
              : 'LOW';

        const refactoringSuggestions = this.generateRefactoringSuggestions(
          node,
          fnComplexity,
          fnMI,
          fnLoc,
          fnHalstead.volume,
        );

        functions.push({
          name: fnName,
          startLine: startLine + 1,
          endLine: endLine + 1,
          cyclomaticComplexity: fnComplexity,
          halstead: fnHalstead,
          linesOfCode: fnLoc,
          maintainabilityIndex: fnMI,
          riskLevel,
          isRefactoringCandidate,
          refactoringSuggestions,
        });
      }

      ts.forEachChild(node, visitForFunctions);
    };

    visitForFunctions(sourceFile);

    // File-level Cyclomatic Complexity:
    // Base 1 + sum of all decision points across the file
    let fileCyclomaticComplexity = 1;
    const countFileDecisions = (node: ts.Node) => {
      if (this.isDecisionPoint(node)) {
        fileCyclomaticComplexity++;
      }
      ts.forEachChild(node, countFileDecisions);
    };
    countFileDecisions(sourceFile);

    // File-level Maintainability Index
    const fileMI = this.calculateMaintainabilityIndex(
      fileHalstead.volume,
      fileCyclomaticComplexity,
      sourceLinesOfCode,
    );

    const fileRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      fileCyclomaticComplexity > 25 || fileMI < 65
        ? 'HIGH'
        : fileCyclomaticComplexity >= 15 || fileMI < 75
          ? 'MEDIUM'
          : 'LOW';

    const highRiskFunctions = functions.filter((fn) => fn.isRefactoringCandidate);

    return {
      filePath,
      language,
      totalLines,
      sourceLinesOfCode,
      cyclomaticComplexity: fileCyclomaticComplexity,
      halstead: fileHalstead,
      maintainabilityIndex: fileMI,
      riskLevel: fileRiskLevel,
      functions,
      highRiskFunctions,
    };
  }

  // =========================================================================
  // Python AST & Lexical Analyzer
  // =========================================================================

  private analyzePythonFile(filePath: string, content: string): FileComplexityDto {
    const lines = content.split('\n');
    const totalLines = lines.length;
    const sourceLinesOfCode = lines.filter(
      (l) => l.trim().length > 0 && !l.trim().startsWith('#'),
    ).length;

    const fileOperators = new Map<string, number>();
    const fileOperands = new Map<string, number>();

    // Python Lexical Parser for Operators & Operands
    const tokens = this.tokenizePython(content);
    for (const t of tokens) {
      if (t.isOperator) {
        fileOperators.set(t.value, (fileOperators.get(t.value) || 0) + 1);
      } else {
        fileOperands.set(t.value, (fileOperands.get(t.value) || 0) + 1);
      }
    }

    const fileHalstead = this.calculateHalsteadMetrics(fileOperators, fileOperands);

    // Extract Python functions
    const functions: FunctionComplexityDto[] = [];
    let fileComplexity = 1;

    let currentFnName = '';
    let currentFnStart = 0;
    let currentFnLines: string[] = [];
    let currentFnIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Count decision points
      if (
        /^(if|elif|while|for)\b/.test(trimmed) ||
        /\b(and|or)\b/.test(trimmed) ||
        /\bexcept(\s+\w+)?:\s*$/.test(trimmed)
      ) {
        fileComplexity++;
      }

      // Detect function definition: def foo(...):
      const defMatch = line.match(/^(\s*)def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (defMatch) {
        if (currentFnName) {
          // Flush previous function
          functions.push(
            this.buildPythonFunction(
              currentFnName,
              currentFnStart,
              i,
              currentFnLines.join('\n'),
            ),
          );
        }
        currentFnName = defMatch[2];
        currentFnStart = i + 1;
        currentFnIndent = defMatch[1].length;
        currentFnLines = [line];
      } else if (currentFnName) {
        const indent = line.search(/\S/);
        if (indent > currentFnIndent || trimmed.length === 0) {
          currentFnLines.push(line);
        } else {
          // Function ended
          functions.push(
            this.buildPythonFunction(
              currentFnName,
              currentFnStart,
              i,
              currentFnLines.join('\n'),
            ),
          );
          currentFnName = '';
          currentFnLines = [];
        }
      }
    }

    if (currentFnName && currentFnLines.length > 0) {
      functions.push(
        this.buildPythonFunction(
          currentFnName,
          currentFnStart,
          lines.length,
          currentFnLines.join('\n'),
        ),
      );
    }

    const fileMI = this.calculateMaintainabilityIndex(
      fileHalstead.volume,
      fileComplexity,
      sourceLinesOfCode,
    );

    const fileRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      fileComplexity > 25 || fileMI < 65
        ? 'HIGH'
        : fileComplexity >= 15 || fileMI < 75
          ? 'MEDIUM'
          : 'LOW';

    const highRiskFunctions = functions.filter((fn) => fn.isRefactoringCandidate);

    return {
      filePath,
      language: 'python',
      totalLines,
      sourceLinesOfCode,
      cyclomaticComplexity: fileComplexity,
      halstead: fileHalstead,
      maintainabilityIndex: fileMI,
      riskLevel: fileRiskLevel,
      functions,
      highRiskFunctions,
    };
  }

  private buildPythonFunction(
    name: string,
    startLine: number,
    endLine: number,
    code: string,
  ): FunctionComplexityDto {
    const lines = code.split('\n');
    let complexity = 1;
    for (const l of lines) {
      const trimmed = l.trim();
      if (/^(if|elif|while|for)\b/.test(trimmed)) complexity++;
      if (/\b(and|or)\b/.test(trimmed)) complexity++;
      if (/\bexcept\b/.test(trimmed)) complexity++;
    }

    const tokens = this.tokenizePython(code);
    const operators = new Map<string, number>();
    const operands = new Map<string, number>();
    for (const t of tokens) {
      if (t.isOperator) {
        operators.set(t.value, (operators.get(t.value) || 0) + 1);
      } else {
        operands.set(t.value, (operands.get(t.value) || 0) + 1);
      }
    }

    const halstead = this.calculateHalsteadMetrics(operators, operands);
    const loc = Math.max(1, endLine - startLine + 1);
    const mi = this.calculateMaintainabilityIndex(halstead.volume, complexity, loc);

    const isRefactoringCandidate = complexity > 15 || mi < 65;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      complexity > 15 || mi < 65
        ? 'HIGH'
        : complexity >= 10 || mi < 75
          ? 'MEDIUM'
          : 'LOW';

    const suggestions: string[] = [];
    if (complexity > 15) {
      suggestions.push(
        `Extract Method: Decompose monolithic function '${name}' (Cyclomatic Complexity: ${complexity}) into atomic sub-functions.`,
      );
      suggestions.push(
        'Guard Clauses: Replace deeply nested conditional statements with early returns.',
      );
    }
    if (halstead.volume > 1000) {
      suggestions.push(
        'Simplify Data Structures: High Halstead Volume indicates high cognitive load. Break down into dedicated dataclasses or dictionaries.',
      );
    }

    return {
      name,
      startLine,
      endLine,
      cyclomaticComplexity: complexity,
      halstead,
      linesOfCode: loc,
      maintainabilityIndex: mi,
      riskLevel,
      isRefactoringCandidate,
      refactoringSuggestions: suggestions,
    };
  }

  private tokenizePython(code: string): Array<{ value: string; isOperator: boolean }> {
    const tokens: Array<{ value: string; isOperator: boolean }> = [];
    const operatorKeywords = new Set([
      'def', 'class', 'if', 'elif', 'else', 'while', 'for', 'in', 'try',
      'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield',
      'break', 'continue', 'pass', 'raise', 'and', 'or', 'not', 'is', 'lambda',
      '+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '<=', '>',
      '>=', '+=', '-=', '*=', '/=', '(', ')', '[', ']', '{', '}', ':', ',',
    ]);

    // Simple regex lexer
    const regex = /[a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|[+\-*/%=<>!&|^~]+|[()[\]{},:]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const val = match[0];
      if (operatorKeywords.has(val) || /[+\-*/%=<>!&|^~]+|[()[\]{},:]/.test(val)) {
        tokens.push({ value: val, isOperator: true });
      } else {
        tokens.push({ value: val, isOperator: false });
      }
    }

    return tokens;
  }

  // =========================================================================
  // Core Metric Formulas & Helper Methods
  // =========================================================================

  /**
   * Computes Thomas McCabe's Cyclomatic Complexity for an AST function scope:
   * Base = 1
   * +1 for each decision point (if, while, for, case with body, catch, ternary, logical &&/||/??)
   */
  public computeFunctionCyclomaticComplexity(functionNode: ts.Node): number {
    let complexity = 1;

    const countBranches = (node: ts.Node) => {
      if (this.isDecisionPoint(node)) {
        complexity++;
      }
      ts.forEachChild(node, countBranches);
    };

    // If it has a body, traverse it; otherwise traverse the node
    const body = (functionNode as any).body || functionNode;
    ts.forEachChild(body, countBranches);

    return complexity;
  }

  /**
   * Checks whether an AST node introduces a decision branch point.
   */
  public isDecisionPoint(node: ts.Node): boolean {
    // If statement
    if (ts.isIfStatement(node)) return true;

    // While / Do..while
    if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return true;

    // Loops (for, for..in, for..of)
    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      return true;
    }

    // Switch case clause (excluding defaultClause)
    if (ts.isCaseClause(node)) return true;

    // Catch clause
    if (ts.isCatchClause(node)) return true;

    // Ternary operator: condition ? a : b
    if (ts.isConditionalExpression(node)) return true;

    // Logical binary expressions: &&, ||, ??
    if (ts.isBinaryExpression(node)) {
      const kind = node.operatorToken.kind;
      if (
        kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        kind === ts.SyntaxKind.BarBarToken ||
        kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Computes Halstead Software Science Metrics:
   * Volume V = N * log2(eta)
   * Difficulty D = (eta1 / 2) * (N2 / eta2)
   * Effort E = D * V
   * Time T = E / 18
   * Bugs B = V / 3000
   */
  public calculateHalsteadMetrics(
    operators: Map<string, number>,
    operands: Map<string, number>,
  ): HalsteadMetricsDto {
    const distinctOperators = operators.size;
    const distinctOperands = operands.size;

    let totalOperators = 0;
    for (const count of operators.values()) totalOperators += count;

    let totalOperands = 0;
    for (const count of operands.values()) totalOperands += count;

    const programVocabulary = distinctOperators + distinctOperands;
    const programLength = totalOperators + totalOperands;

    const volume =
      programVocabulary > 0
        ? parseFloat((programLength * Math.log2(programVocabulary)).toFixed(2))
        : 0;

    const difficulty =
      distinctOperands > 0
        ? parseFloat(((distinctOperators / 2) * (totalOperands / distinctOperands)).toFixed(2))
        : 0;

    const effort = parseFloat((difficulty * volume).toFixed(2));
    const time = parseFloat((effort / 18).toFixed(2));
    const bugs = parseFloat((volume / 3000).toFixed(4));

    return {
      distinctOperators,
      distinctOperands,
      totalOperators,
      totalOperands,
      programVocabulary,
      programLength,
      volume,
      difficulty,
      effort,
      time,
      bugs,
    };
  }

  /**
   * Calculates Maintainability Index (MI):
   * Standard SEI formula:
   * MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
   * Scaled to [0, 100] where MI >= 85 is High (Green), 65-84 is Moderate (Yellow), < 65 is Low / High-Risk (Red).
   */
  public calculateMaintainabilityIndex(
    halsteadVolume: number,
    cyclomaticComplexity: number,
    linesOfCode: number,
  ): number {
    const safeV = Math.max(1, halsteadVolume);
    const safeG = Math.max(1, cyclomaticComplexity);
    const safeLoc = Math.max(1, linesOfCode);

    const rawMI =
      171 - 5.2 * Math.log(safeV) - 0.23 * safeG - 16.2 * Math.log(safeLoc);

    // Standard bounding between 0 and 100
    const boundedMI = Math.max(0, Math.min(100, rawMI));
    return parseFloat(boundedMI.toFixed(1));
  }

  /**
   * Inspects AST nodes to collect operators and operands for Halstead metrics.
   */
  private collectHalsteadTokens(
    node: ts.Node,
    operators: Map<string, number>,
    operands: Map<string, number>,
  ) {
    // Operands: Identifiers and Literals
    if (ts.isIdentifier(node)) {
      const text = node.text;
      operands.set(text, (operands.get(text) || 0) + 1);
      return;
    }

    if (
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword
    ) {
      const text = node.getText();
      operands.set(text, (operands.get(text) || 0) + 1);
      return;
    }

    // Operators: Keywords and syntax punctuation
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.getText();
      operators.set(op, (operators.get(op) || 0) + 1);
    } else if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const op = ts.tokenToString(node.operator) || 'unary';
      operators.set(op, (operators.get(op) || 0) + 1);
    } else if (
      ts.isIfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isCaseClause(node) ||
      ts.isDefaultClause(node) ||
      ts.isTryStatement(node) ||
      ts.isCatchClause(node) ||
      ts.isReturnStatement(node) ||
      ts.isThrowStatement(node) ||
      ts.isCallExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isConditionalExpression(node)
    ) {
      const opName = ts.SyntaxKind[node.kind];
      operators.set(opName, (operators.get(opName) || 0) + 1);
    }
  }

  /**
   * Extracts function name from AST node.
   */
  private extractFunctionName(node: ts.Node, sourceFile: ts.SourceFile): string {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isMethodDeclaration(node) && node.name) {
      return node.name.getText(sourceFile);
    }
    if (ts.isConstructorDeclaration(node)) {
      return 'constructor';
    }
    // Arrow function or function expression assigned to variable or property
    if (node.parent) {
      if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
        return node.parent.name.text;
      }
      if (ts.isPropertyDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
        return node.parent.name.text;
      }
      if (ts.isBinaryExpression(node.parent) && node.parent.left) {
        return node.parent.left.getText(sourceFile);
      }
    }
    return 'anonymousFunction';
  }

  /**
   * Generates actionable refactoring guidance for high-complexity functions.
   */
  public generateRefactoringSuggestions(
    node: ts.Node,
    complexity: number,
    maintainability: number,
    loc: number,
    volume: number,
  ): string[] {
    const suggestions: string[] = [];

    if (complexity > 15) {
      suggestions.push(
        `Extract Method: Decompose monolithic function with Cyclomatic Complexity of ${complexity} (> 15) into smaller, single-responsibility helper functions.`,
      );
    }

    // Check for nested if statements (pyramid of doom)
    let maxNesting = 0;
    const checkNesting = (curr: ts.Node, depth: number) => {
      if (ts.isIfStatement(curr)) {
        maxNesting = Math.max(maxNesting, depth);
        ts.forEachChild(curr, (c) => checkNesting(c, depth + 1));
      } else {
        ts.forEachChild(curr, (c) => checkNesting(c, depth));
      }
    };
    checkNesting(node, 1);

    if (maxNesting >= 3) {
      suggestions.push(
        'Guard Clauses: Replace deeply nested conditional logic (nesting level >= 3) with early returns to eliminate the pyramid of doom.',
      );
    }

    // Check for switch cases
    let caseCount = 0;
    const countCases = (curr: ts.Node) => {
      if (ts.isCaseClause(curr)) caseCount++;
      ts.forEachChild(curr, countCases);
    };
    countCases(node);

    if (caseCount >= 4) {
      suggestions.push(
        `Strategy Pattern: Switch statement contains ${caseCount} branch cases. Replace with a Strategy Pattern, polymorphic handler map, or dictionary lookup.`,
      );
    }

    if (loc > 60) {
      suggestions.push(
        `Function Length: Routine spans ${loc} lines. Consider decomposing into smaller computational units adhering to the Single Responsibility Principle.`,
      );
    }

    if (maintainability < 65) {
      suggestions.push(
        `Maintainability Hotspot: Maintainability Index is ${maintainability} (< 65). Reduce parameter count and decompose complex expressions to minimize cognitive load.`,
      );
    }

    return suggestions;
  }

  private inferLanguage(filePath: string): string {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
    if (filePath.endsWith('.py')) return 'python';
    return 'typescript';
  }
}
