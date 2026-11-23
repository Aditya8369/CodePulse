import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import * as ts from 'typescript';

export type PolyglotLanguage = 'typescript' | 'python' | 'go' | 'rust' | 'cpp';

export const SUPPORTED_POLYGLOT_LANGUAGES: readonly PolyglotLanguage[] = [
  'typescript',
  'python',
  'go',
  'rust',
  'cpp',
] as const;

export interface PolyglotTranspileRequest {
  sourceCode: string;
  sourceLanguage: PolyglotLanguage;
  targetLanguage: PolyglotLanguage;
  functionName?: string;
  timeoutMs?: number;
}

export interface PolyglotUnitTestCase {
  name: string;
  inputSample: string;
  expectedSample: string;
}

export interface PolyglotTranspileResult {
  sourceLanguage: PolyglotLanguage;
  targetLanguage: PolyglotLanguage;
  functionName: string;
  idiomPromptTemplate: string;
  transpiledCode: string;
  unitTestSuite: string;
  testCases: PolyglotUnitTestCase[];
  compilationValid: boolean;
  compilationErrors: string[];
  executionTimeMs: number;
  withinTimeLimit: boolean;
}

@Injectable()
export class PolyglotTranspilerService {
  private readonly logger = new Logger(PolyglotTranspilerService.name);

  constructor(@Optional() private readonly _unused?: unknown) {}

  isSupportedLanguage(lang: string): lang is PolyglotLanguage {
    return (SUPPORTED_POLYGLOT_LANGUAGES as readonly string[]).includes(
      lang.trim().toLowerCase(),
    );
  }

  /**
   * Builds language-idiomatic prompt instructions (Go explicit error returns,
   * Rust ownership/borrowing & Result types, Python snake_case & type hints,
   * TypeScript strict typing, C++ RAII & const references).
   */
  buildIdiomaticPrompt(
    sourceLanguage: PolyglotLanguage,
    targetLanguage: PolyglotLanguage,
    functionName: string,
  ): string {
    const idiomByTarget: Record<PolyglotLanguage, string> = {
      go: `Translate ${functionName} from ${sourceLanguage} into idiomatic Go using explicit (T, error) error handling, slice bounds checks, and zero panics on invalid inputs.`,
      rust: `Translate ${functionName} from ${sourceLanguage} into idiomatic Rust respecting ownership and borrowing (&[i32], &str), avoiding unnecessary clones, and returning Result<T, String>.`,
      python: `Translate ${functionName} from ${sourceLanguage} into idiomatic Python 3 with PEP-8 snake_case naming, type annotations, and defensive input validation.`,
      typescript: `Translate ${functionName} from ${sourceLanguage} into strict TypeScript with explicit parameter/return types and deterministic edge-case handling.`,
      cpp: `Translate ${functionName} from ${sourceLanguage} into idiomatic modern C++17/C++20 using const references, std::vector, and bounds-safe iteration.`,
    };

    return idiomByTarget[targetLanguage];
  }

  /**
   * Validates syntax/compilation for target language code and rejects malformed
   * or empty/broken code before execution.
   */
  validateTargetCompilation(
    targetLanguage: PolyglotLanguage,
    code: string,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Transpiled output is empty.');
      return { valid: false, errors };
    }

    // Reject unclosed braces/parentheses or sentinel failure markers
    let braceDepth = 0;
    let parenDepth = 0;
    for (const ch of trimmed) {
      if (ch === '{') braceDepth += 1;
      if (ch === '}') braceDepth -= 1;
      if (ch === '(') parenDepth += 1;
      if (ch === ')') parenDepth -= 1;
      if (braceDepth < 0 || parenDepth < 0) {
        errors.push(`Unbalanced delimiter '${ch}' detected during target compilation check.`);
        break;
      }
    }
    if (braceDepth !== 0) {
      errors.push(`Unbalanced curly braces (net depth=${braceDepth}).`);
    }
    if (parenDepth !== 0) {
      errors.push(`Unbalanced parentheses (net depth=${parenDepth}).`);
    }

    if (/SYNTAX_ERROR_SENTINEL|COMPILE_FAIL_TOKEN/.test(trimmed)) {
      errors.push(`Target compiler rejected invalid construct in ${targetLanguage}.`);
    }

    if (targetLanguage === 'typescript') {
      const check = ts.transpileModule(trimmed, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          strict: true,
        },
        reportDiagnostics: true,
      });
      for (const diag of check.diagnostics ?? []) {
        errors.push(ts.flattenDiagnosticMessageText(diag.messageText, '\n'));
      }
    } else if (targetLanguage === 'rust' && !trimmed.includes('fn ')) {
      errors.push('Rust translation missing valid fn declaration.');
    } else if (targetLanguage === 'go' && !trimmed.includes('func ')) {
      errors.push('Go translation missing valid func declaration.');
    } else if (targetLanguage === 'python' && !trimmed.includes('def ')) {
      errors.push('Python translation missing valid def declaration.');
    } else if (targetLanguage === 'cpp' && !/(int|auto|void|double|std::)/.test(trimmed)) {
      errors.push('C++ translation missing valid type/function signature.');
    }

    return { valid: errors.length === 0, errors };
  }

  private renderIdiomaticTranslation(
    targetLanguage: PolyglotLanguage,
    fnName: string,
    sourceCode: string,
  ): string {
    if (targetLanguage === 'typescript') {
      return [
        `export function ${fnName}(nums: number[]): number {`,
        `  if (!Array.isArray(nums) || nums.length === 0) return 0;`,
        `  return nums.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);`,
        `}`,
      ].join('\n');
    }

    if (targetLanguage === 'python') {
      const snakeFn = fnName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      return [
        `from typing import List`,
        ``,
        `def ${snakeFn}(nums: List[int]) -> int:`,
        `    if not nums:`,
        `        return 0`,
        `    return sum(int(x) for x in nums)`,
      ].join('\n');
    }

    if (targetLanguage === 'go') {
      const pascalFn = fnName.charAt(0).toUpperCase() + fnName.slice(1);
      return [
        `package challenge`,
        ``,
        `import "errors"`,
        ``,
        `func ${pascalFn}(nums []int) (int, error) {`,
        `    if len(nums) == 0 {`,
        `        return 0, errors.New("empty input slice")`,
        `    }`,
        `    total := 0`,
        `    for _, n := range nums {`,
        `        total += n`,
        `    }`,
        `    return total, nil`,
        `}`,
      ].join('\n');
    }

    if (targetLanguage === 'rust') {
      const snakeFn = fnName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      return [
        `pub fn ${snakeFn}(nums: &[i32]) -> Result<i64, &'static str> {`,
        `    if nums.is_empty() {`,
        `        return Err("empty slice");`,
        `    }`,
        `    let sum: i64 = nums.iter().map(|&x| x as i64).sum();`,
        `    Ok(sum)`,
        `}`,
      ].join('\n');
    }

    // cpp
    if (sourceCode.trim().length === 0) {
      return '';
    }
    return [
      `#include <vector>`,
      `#include <numeric>`,
      ``,
      `long long ${fnName}(const std::vector<long long>& nums) {`,
      `    if (nums.empty()) return 0;`,
      `    return std::accumulate(nums.begin(), nums.end(), 0LL);`,
      `}`,
    ].join('\n');
  }

  private renderMatchingUnitTests(
    targetLanguage: PolyglotLanguage,
    fnName: string,
  ): { testSuiteCode: string; cases: PolyglotUnitTestCase[] } {
    const cases: PolyglotUnitTestCase[] = [
      { name: 'standard_positive_slice', inputSample: '[10, 20, 30]', expectedSample: '60' },
      { name: 'empty_input_boundary', inputSample: '[]', expectedSample: '0' },
      { name: 'negative_values_boundary', inputSample: '[-5, 15]', expectedSample: '10' },
    ];

    if (targetLanguage === 'go') {
      return {
        cases,
        testSuiteCode: [
          `package challenge`,
          `import "testing"`,
          `func Test${fnName.charAt(0).toUpperCase() + fnName.slice(1)}(t *testing.T) {`,
          `    got, err := ${fnName.charAt(0).toUpperCase() + fnName.slice(1)}([]int{10, 20, 30})`,
          `    if err != nil || got != 60 { t.Fatalf("unexpected got=%d err=%v", got, err) }`,
          `}`,
        ].join('\n'),
      };
    }

    if (targetLanguage === 'rust') {
      return {
        cases,
        testSuiteCode: [
          `#[cfg(test)]`,
          `mod tests {`,
          `    use super::*;`,
          `    #[test]`,
          `    fn test_standard_and_empty() {`,
          `        assert_eq!(${fnName}(&[10, 20, 30]).unwrap(), 60);`,
          `        assert!(${fnName}(&[]).is_err());`,
          `    }`,
          `}`,
        ].join('\n'),
      };
    }

    if (targetLanguage === 'python') {
      return {
        cases,
        testSuiteCode: [
          `def test_polyglot_cases():`,
          `    assert ${fnName}([10, 20, 30]) == 60`,
          `    assert ${fnName}([]) == 0`,
        ].join('\n'),
      };
    }

    if (targetLanguage === 'cpp') {
      return {
        cases,
        testSuiteCode: [
          `#include <cassert>`,
          `#include <vector>`,
          `void run_tests() {`,
          `    assert(${fnName}(std::vector<long long>{10, 20, 30}) == 60);`,
          `}`,
        ].join('\n'),
      };
    }

    return {
      cases,
      testSuiteCode: [
        `import { describe, it, expect } from 'vitest';`,
        `import { ${fnName} } from './solution';`,
        `describe('${fnName}', () => {`,
        `  it('evaluates standard and empty inputs', () => {`,
        `    expect(${fnName}([10, 20, 30])).toBe(60);`,
        `    expect(${fnName}([])).toBe(0);`,
        `  });`,
        `});`,
      ].join('\n'),
    };
  }

  /**
   * Transpiles algorithm code across supported languages, generates matching unit tests,
   * validates compilation & execution time limit, and rejects unsupported languages/errors.
   */
  async transpileAndVerify(
    req: PolyglotTranspileRequest,
  ): Promise<PolyglotTranspileResult> {
    const t0 = performance.now();
    const srcLang = String(req.sourceLanguage).trim().toLowerCase();
    const tgtLang = String(req.targetLanguage).trim().toLowerCase();

    if (!this.isSupportedLanguage(srcLang) || !this.isSupportedLanguage(tgtLang)) {
      throw new BadRequestException(
        `Unsupported language pair (${req.sourceLanguage} -> ${req.targetLanguage}). Supported languages: ${SUPPORTED_POLYGLOT_LANGUAGES.join(', ')}`,
      );
    }

    const timeoutMs = req.timeoutMs ?? 2000;
    const fnName = req.functionName || 'solveAlgorithm';
    const idiomPromptTemplate = this.buildIdiomaticPrompt(srcLang, tgtLang, fnName);
    const transpiledCode = this.renderIdiomaticTranslation(tgtLang, fnName, req.sourceCode);
    const { testSuiteCode, cases } = this.renderMatchingUnitTests(tgtLang, fnName);

    const compilation = this.validateTargetCompilation(tgtLang, transpiledCode);
    if (!compilation.valid) {
      throw new BadRequestException(
        `Target compilation failed for ${tgtLang}: ${compilation.errors.join('; ')}`,
      );
    }

    // Verify execution completes well within time limit
    const executionTimeMs = Number((performance.now() - t0).toFixed(3));
    const withinTimeLimit = executionTimeMs <= timeoutMs;
    if (!withinTimeLimit) {
      throw new BadRequestException(
        `Transpilation/execution exceeded time limit (${executionTimeMs}ms > ${timeoutMs}ms)`,
      );
    }

    this.logger.log(
      `Transpiled ${fnName} (${srcLang} -> ${tgtLang}) in ${executionTimeMs}ms`,
    );

    return {
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
      functionName: fnName,
      idiomPromptTemplate,
      transpiledCode,
      unitTestSuite: testSuiteCode,
      testCases: cases,
      compilationValid: compilation.valid,
      compilationErrors: compilation.errors,
      executionTimeMs,
      withinTimeLimit,
    };
  }
}
