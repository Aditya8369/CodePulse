import { BadRequestException } from '@nestjs/common';
import {
  PolyglotTranspilerService,
  SUPPORTED_POLYGLOT_LANGUAGES,
} from './polyglot-transpiler.service';

describe('PolyglotTranspilerService (5 Languages, Idioms, Unit Tests & Error Traps)', () => {
  let service: PolyglotTranspilerService;

  beforeEach(() => {
    service = new PolyglotTranspilerService();
  });

  it('transpiles across all 5 supported languages with matching unit tests and time limits', async () => {
    const sampleTs = 'export function solveAlgorithm(nums: number[]): number { return nums.length; }';

    for (const targetLang of SUPPORTED_POLYGLOT_LANGUAGES) {
      const res = await service.transpileAndVerify({
        sourceCode: sampleTs,
        sourceLanguage: 'typescript',
        targetLanguage: targetLang,
        functionName: 'solveAlgorithm',
        timeoutMs: 2000,
      });

      expect(res.targetLanguage).toBe(targetLang);
      expect(res.compilationValid).toBe(true);
      expect(res.withinTimeLimit).toBe(true);
      expect(res.unitTestSuite.length).toBeGreaterThan(20);
      expect(res.testCases.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('enforces Go error tuples and Rust ownership/Result idioms', async () => {
    const goRes = await service.transpileAndVerify({
      sourceCode: 'export function calcSum(nums: number[]): number { return 0; }',
      sourceLanguage: 'typescript',
      targetLanguage: 'go',
      functionName: 'calcSum',
    });
    expect(goRes.transpiledCode).toContain('(int, error)');

    const rustRes = await service.transpileAndVerify({
      sourceCode: 'export function calcSum(nums: number[]): number { return 0; }',
      sourceLanguage: 'typescript',
      targetLanguage: 'rust',
      functionName: 'calcSum',
    });
    expect(rustRes.transpiledCode).toContain('&[i32]');
    expect(rustRes.transpiledCode).toContain('Result<i64,');
  });

  it('rejects unsupported languages and invalid/uncompilable code constructs', async () => {
    await expect(
      service.transpileAndVerify({
        sourceCode: 'def foo(): pass',
        sourceLanguage: 'python',
        targetLanguage: 'brainfuck' as any,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.transpileAndVerify({
        sourceCode: 'COMPILE_FAIL_TOKEN',
        sourceLanguage: 'typescript',
        targetLanguage: 'typescript',
        functionName: 'brokenFn() { COMPILE_FAIL_TOKEN',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
