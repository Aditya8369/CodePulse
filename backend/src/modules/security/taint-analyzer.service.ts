import { Injectable, Logger } from '@nestjs/common';
import {
  DANGEROUS_SINKS,
  DangerousSinkDefinition,
  OBFUSCATION_PATTERNS,
  SinkCategory,
} from './ast-rules';

export interface TaintViolation {
  sinkCategory: SinkCategory;
  sinkIdentifier: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lineNumber: number;
  snippet: string;
  taintedPath: string[];
  message: string;
}

export interface TaintAnalysisReport {
  isSafe: boolean;
  disqualified: boolean;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'CRITICAL';
  violations: TaintViolation[];
  analysisDurationMs: number;
  totalChecksRun: number;
}

@Injectable()
export class TaintAnalyzerService {
  private readonly logger = new Logger(TaintAnalyzerService.name);

  // Cumulative metrics
  private totalScans = 0;
  private totalViolationsDetected = 0;

  /**
   * Performs static source-to-sink taint analysis on a submission without executing code.
   */
  analyzeCode(
    sourceCode: string,
    language: 'javascript' | 'typescript' | 'python' | 'cpp' = 'javascript',
  ): TaintAnalysisReport {
    const startTime = performance.now();
    this.totalScans++;

    const violations: TaintViolation[] = [];
    const lines = sourceCode.split('\n');

    // 1. De-obfuscate hex / unicode character escapes
    const deobfuscatedCode = this.normalizeEscapes(sourceCode);
    const deobfuscatedLines = deobfuscatedCode.split('\n');

    // 2. Track tainted variable flows
    const taintedVariables = this.trackTaintedVariables(lines);

    // 3. Scan for obfuscation patterns
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      for (const pattern of OBFUSCATION_PATTERNS) {
        if (pattern.pattern.test(line)) {
          violations.push({
            sinkCategory: 'DYNAMIC_CODE',
            sinkIdentifier: 'obfuscated_invocation',
            severity: 'CRITICAL',
            lineNumber: lineIdx + 1,
            snippet: line.trim(),
            taintedPath: ['[Obfuscation Source]', '[Dynamic Evaluator]'],
            message: `Detected obfuscated evasion technique: ${pattern.description}`,
          });
        }
      }
    }

    // 4. Scan for direct dangerous sinks & tainted variables reaching sinks
    const applicableSinks = DANGEROUS_SINKS.filter((s) => s.languages.includes(language));

    for (let lineIdx = 0; lineIdx < deobfuscatedLines.length; lineIdx++) {
      const line = deobfuscatedLines[lineIdx];

      for (const sink of applicableSinks) {
        const regex = new RegExp(`\\b${this.escapeRegex(sink.identifier)}\\b`);

        if (regex.test(line)) {
          // Check if tainted variable is passed to this sink
          const taintedArg = Array.from(taintedVariables).find((tVar) => line.includes(tVar));
          const taintedPath = taintedArg
            ? ['[External Input: userInput]', `[Variable: ${taintedArg}]`, `[Sink: ${sink.identifier}]`]
            : ['[Direct Insecure Invocation]', `[Sink: ${sink.identifier}]`];

          violations.push({
            sinkCategory: sink.category,
            sinkIdentifier: sink.identifier,
            severity: sink.severity,
            lineNumber: lineIdx + 1,
            snippet: line.trim(),
            taintedPath,
            message: `Unsanitized invocation of restricted sink "${sink.identifier}" (${sink.description})`,
          });
        }
      }
    }

    const durationMs = Number((performance.now() - startTime).toFixed(3));
    const isSafe = violations.length === 0;
    const hasCritical = violations.some((v) => v.severity === 'CRITICAL');
    const hasHigh = violations.some((v) => v.severity === 'HIGH');

    let riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'CRITICAL' = 'SAFE';
    if (hasCritical) riskLevel = 'CRITICAL';
    else if (hasHigh) riskLevel = 'MEDIUM';
    else if (!isSafe) riskLevel = 'LOW';

    if (!isSafe) {
      this.totalViolationsDetected += violations.length;
      this.logger.warn(
        `[SECURITY_ALERT] Taint analysis flagged ${violations.length} violations in submission. Disqualified: ${hasCritical}`,
      );
    }

    return {
      isSafe,
      disqualified: hasCritical,
      riskLevel,
      violations,
      analysisDurationMs: durationMs,
      totalChecksRun: lines.length * (applicableSinks.length + OBFUSCATION_PATTERNS.length),
    };
  }

  private trackTaintedVariables(lines: string[]): Set<string> {
    const tainted = new Set<string>(['payload', 'input', 'req', 'body', 'data', 'params', 'args']);

    // Follow assignment propagation: const y = input; const z = y;
    for (const line of lines) {
      const match = line.match(/(?:let|const|var)\s+([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9_.]+)/);
      if (match) {
        const [, varName, assignedFrom] = match;
        for (const t of Array.from(tainted)) {
          if (assignedFrom.includes(t)) {
            tainted.add(varName);
          }
        }
      }
    }

    return tainted;
  }

  private normalizeEscapes(str: string): string {
    // Decode \x65\x76\x61\x6c -> eval
    return str.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getMetrics() {
    return {
      totalScans: this.totalScans,
      totalViolationsDetected: this.totalViolationsDetected,
    };
  }
}
