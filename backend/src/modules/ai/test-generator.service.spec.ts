import { TestGeneratorService, type TsMorphProjectLike } from './test-generator.service';

describe('TestGeneratorService (ts-morph AST Inspection, Boundary Synthesis & Vitest Emission)', () => {
  let service: TestGeneratorService;

  beforeEach(() => {
    service = new TestGeneratorService();
  });

  it('mocks ts-morph AST inspection, generates >=8 boundary cases, compiles with 0 TS errors, and passes reference solution', async () => {
    const mockTsMorphProject: TsMorphProjectLike = {
      createSourceFile: jest.fn().mockReturnValue({
        getInterfaces: () => [
          {
            getName: () => 'WindowConfig',
            getProperties: () => [
              { getName: () => 'limit', getTypeNode: () => ({ getText: () => 'number' }) },
            ],
          },
        ],
        getFunctions: () => [
          {
            getName: () => 'safeArraySum',
            getParameters: () => [
              {
                getName: () => 'nums',
                getTypeNode: () => ({ getText: () => 'number[]' }),
                isOptional: () => false,
              },
              {
                getName: () => 'label',
                getTypeNode: () => ({ getText: () => 'string' }),
                isOptional: () => true,
              },
            ],
            getReturnTypeNode: () => ({ getText: () => 'number' }),
          },
        ],
      }),
    };

    const referenceSafeArraySum = (nums: number[] | null): number => {
      if (!Array.isArray(nums) || nums.length === 0) return 0;
      return nums.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
    };

    const result = await service.synthesizeAndVerifyTestSuite({
      challengeId: 'chal-524',
      sourceCode: 'export function safeArraySum(nums: number[], label?: string): number { return 0; }',
      referenceSolutionFn: referenceSafeArraySum,
      tsMorphProject: mockTsMorphProject,
    });

    expect(mockTsMorphProject.createSourceFile).toHaveBeenCalledTimes(1);
    expect(result.signature.functionName).toBe('safeArraySum');
    expect(result.edgeCases.length).toBeGreaterThanOrEqual(8);
    expect(result.typeCheckErrors).toEqual([]);
    expect(result.verifiedAgainstReference).toBe(true);
    expect(result.passedCount).toBe(result.totalCount);
    expect(result.vitestSpecCode).toContain("import { describe, it, expect, vi, beforeEach } from 'vitest';");
  });
});
