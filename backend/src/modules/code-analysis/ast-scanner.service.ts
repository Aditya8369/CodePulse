import { Injectable, Logger } from '@nestjs/common';
import * as ts from 'typescript';

export interface CodeSmellFinding {
  type: 'GOD_FUNCTION' | 'EXCESSIVE_PARAMETERS' | 'DEEP_NESTING' | 'HIGH_CYCLOMATIC_COMPLEXITY';
  message: string;
  line: number;
  metricValue: number;
}

export interface FileQualityAnalysis {
  filePath: string;
  cyclomaticComplexity: number;
  maintainabilityIndex: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  codeSmells: CodeSmellFinding[];
  linesOfCode: number;
}

@Injectable()
export class AstScannerService {
  private readonly logger = new Logger(AstScannerService.name);

  /**
   * Scans a TypeScript/JavaScript code snippet and evaluates cyclomatic complexity,
   * nesting depth, parameter counts, and overall maintainability index.
   */
  analyzeCode(sourceCode: string, filePath = 'snippet.ts'): FileQualityAnalysis {
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    let cyclomaticComplexity = 1; // base complexity
    const codeSmells: CodeSmellFinding[] = [];
    const linesOfCode = sourceCode.split('\n').length;

    const traverse = (node: ts.Node, depth: number) => {
      // Check nesting level penalty (> 4 levels)
      if (depth > 4) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        codeSmells.push({
          type: 'DEEP_NESTING',
          message: `Deeply nested block with depth level ${depth} exceeds maximum threshold of 4.`,
          line: line + 1,
          metricValue: depth,
        });
      }

      // Cyclomatic Complexity branching nodes
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression: // ternary operator ? :
          cyclomaticComplexity++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const binaryExpr = node as ts.BinaryExpression;
          if (
            binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
            binaryExpr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
          ) {
            cyclomaticComplexity++;
          }
          break;
        }
      }

      // Check function length (God function > 80 lines) & parameters (> 5)
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        const fnLength = end - start + 1;

        if (fnLength > 80) {
          codeSmells.push({
            type: 'GOD_FUNCTION',
            message: `Function is excessively long (${fnLength} lines). Consider decomposing into smaller modular units.`,
            line: start + 1,
            metricValue: fnLength,
          });
        }

        if (node.parameters.length > 5) {
          codeSmells.push({
            type: 'EXCESSIVE_PARAMETERS',
            message: `Function takes ${node.parameters.length} parameters, exceeding the recommended maximum of 5.`,
            line: start + 1,
            metricValue: node.parameters.length,
          });
        }
      }

      ts.forEachChild(node, child => traverse(child, depth + 1));
    };

    traverse(sourceFile, 0);

    // Calculate Maintainability Index (MI formula approximation: 171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC))
    const halsteadVolume = linesOfCode * 15;
    const rawMi =
      171 -
      5.2 * Math.log(Math.max(1, halsteadVolume)) -
      0.23 * cyclomaticComplexity -
      16.2 * Math.log(Math.max(1, linesOfCode));
    const normalizedMi = Math.max(0, Math.min(100, Math.round((rawMi * 100) / 171)));

    let grade: FileQualityAnalysis['grade'] = 'A';
    if (normalizedMi < 40) grade = 'F';
    else if (normalizedMi < 60) grade = 'D';
    else if (normalizedMi < 75) grade = 'C';
    else if (normalizedMi < 85) grade = 'B';

    return {
      filePath,
      cyclomaticComplexity,
      maintainabilityIndex: normalizedMi,
      grade,
      codeSmells,
      linesOfCode,
    };
  }
}
