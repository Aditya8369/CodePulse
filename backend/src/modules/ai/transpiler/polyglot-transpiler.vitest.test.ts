import { describe, it, expect } from 'vitest';
import { PolyglotTranspilerService } from './polyglot-transpiler.service';

describe('PolyglotTranspilerService (Vitest)', () => {
  it('generates idiomatic Python and C++ code plus unit tests within time limit', async () => {
    const transpiler = new PolyglotTranspilerService();
    const pyOut = await transpiler.transpileAndVerify({
      sourceCode: 'export function sumValues(nums: number[]): number { return 0; }',
      sourceLanguage: 'typescript',
      targetLanguage: 'python',
      functionName: 'sumValues',
    });
    expect(pyOut.transpiledCode).toContain('def sum_values');
    expect(pyOut.unitTestSuite).toContain('def test_polyglot_cases');

    const cppOut = await transpiler.transpileAndVerify({
      sourceCode: 'export function sumValues(nums: number[]): number { return 0; }',
      sourceLanguage: 'typescript',
      targetLanguage: 'cpp',
      functionName: 'sumValues',
    });
    expect(cppOut.transpiledCode).toContain('std::vector<long long>');
  });
});
