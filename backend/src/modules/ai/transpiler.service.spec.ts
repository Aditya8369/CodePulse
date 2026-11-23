import { Test, TestingModule } from '@nestjs/testing';
import { TranspilerService } from './transpiler.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TranspilerService Polyglot & Idiomatic Migration Suite (#438)', () => {
  let service: TranspilerService;

  const prismaMock = {
    challengeTemplate: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const sampleTypeScriptTwoSum = `
function twoSum(nums: number[], target: number): number[] {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
  `.trim();

  const twoSumTestCases = [
    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { input: [[3, 2, 4], 6], expected: [1, 2] },
    { input: [[3, 3], 6], expected: [0, 1] },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranspilerService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<TranspilerService>(TranspilerService);
  });

  describe('AST Parsing & Function Extraction', () => {
    it('extracts function signature, parameters, and types from TypeScript source', () => {
      const ast = service.extractFunctionAst(sampleTypeScriptTwoSum, 'typescript');

      expect(ast.name).toBe('twoSum');
      expect(ast.params).toEqual([
        { name: 'nums', type: 'number[]' },
        { name: 'target', type: 'number' },
      ]);
      expect(ast.returnType).toBe('number[]');
    });
  });

  describe('TypeScript -> Python Idiomatic Transpilation', () => {
    it('converts to snake_case, type annotations, and verifies behavioral equivalence', async () => {
      const res = await service.transpile({
        sourceCode: sampleTypeScriptTwoSum,
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
        testCases: twoSumTestCases,
      });

      expect(res.sourceLanguage).toBe('typescript');
      expect(res.targetLanguage).toBe('python');
      expect(res.functionSignature).toContain('def two_sum(nums: List[int], target: int) -> List[int]:');
      expect(res.transpiledCode).toContain('def two_sum');
      expect(res.transpiledCode).toContain('from typing import');

      // Idiomatic conventions
      expect(res.idiomaticTransformations.some((t) => t.includes('snake_case'))).toBe(true);

      // Automated test verification
      expect(res.testVerification.verified).toBe(true);
      expect(res.testVerification.passedTests).toBe(3);
      expect(res.testVerification.totalTests).toBe(3);

      // Starter template stub
      expect(res.starterCode).toContain('def two_sum');
      expect(res.starterCode).toContain('pass');
    });

    it('transforms array .map chains into idiomatic Python list comprehensions', async () => {
      const arrayMapSnippet = `
function doubleEvens(nums: number[]): number[] {
  return nums.map(x => x * 2);
}
      `.trim();

      const res = await service.transpile({
        sourceCode: arrayMapSnippet,
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
      });

      expect(res.transpiledCode).toContain('[x * 2 for x in nums]');
      expect(res.idiomaticTransformations.some((t) => t.includes('list comprehensions'))).toBe(true);
    });
  });

  describe('TypeScript -> Go Idiomatic Transpilation', () => {
    it('converts to exported PascalCase function, slices, and Go types', async () => {
      const res = await service.transpile({
        sourceCode: sampleTypeScriptTwoSum,
        sourceLanguage: 'typescript',
        targetLanguage: 'go',
        testCases: twoSumTestCases,
      });

      expect(res.targetLanguage).toBe('go');
      expect(res.functionSignature).toContain('func TwoSum(nums []int, target int) []int');
      expect(res.transpiledCode).toContain('package solution');
      expect(res.transpiledCode).toContain('func TwoSum');

      // Idiomatic Go transformations
      expect(res.idiomaticTransformations.some((t) => t.includes('PascalCase'))).toBe(true);

      // Starter code
      expect(res.starterCode).toContain('func TwoSum');
      expect(res.starterCode).toContain('panic("not implemented")');
    });
  });

  describe('TypeScript -> Rust Idiomatic Transpilation', () => {
    it('converts to pub fn with snake_case and Vec<i32> collections', async () => {
      const res = await service.transpile({
        sourceCode: sampleTypeScriptTwoSum,
        sourceLanguage: 'typescript',
        targetLanguage: 'rust',
        testCases: twoSumTestCases,
      });

      expect(res.targetLanguage).toBe('rust');
      expect(res.functionSignature).toContain('pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32>');
      expect(res.transpiledCode).toContain('pub fn two_sum');

      // Idiomatic Rust transformations
      expect(res.idiomaticTransformations.some((t) => t.includes('snake_case'))).toBe(true);

      // Starter code
      expect(res.starterCode).toContain('pub fn two_sum');
      expect(res.starterCode).toContain('todo!()');
      expect(res.testVerification.verified).toBe(true);
      expect(res.testVerification.passedTests).toBe(3);
    });

    it('maps Option/Result and error patterns idiomatically in Rust and Go (#1069)', async () => {
      const nullableSnippet = `
function findItem(nums: number[], target: number): number | null {
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === target) return nums[i];
  }
  return null;
}
      `.trim();

      const rustRes = await service.transpile({
        sourceCode: nullableSnippet,
        sourceLanguage: 'typescript',
        targetLanguage: 'rust',
      });
      expect(rustRes.transpiledCode).toContain('pub fn find_item');
      expect(rustRes.functionSignature).toContain('Option<i32>');

      const goRes = await service.transpile({
        sourceCode: nullableSnippet,
        sourceLanguage: 'typescript',
        targetLanguage: 'go',
      });
      expect(goRes.transpiledCode).toContain('func FindItem');
    });
  });

  describe('Bidirectional Polyglot Transpilation & Reference Tests (#1069)', () => {
    it('transpiles Python source to TypeScript and verifies equivalence', async () => {
      const pythonSource = `
def double_values(nums: List[int]) -> List[int]:
    return [x * 2 for x in nums]
      `.trim();

      const res = await service.transpile({
        sourceCode: pythonSource,
        sourceLanguage: 'python',
        targetLanguage: 'typescript',
        testCases: [
          { input: [[1, 2, 3]], expected: [2, 4, 6] },
          { input: [[0, -5]], expected: [0, -10] },
        ],
      });

      expect(res.targetLanguage).toBe('typescript');
      expect(res.transpiledCode).toContain('export function doubleValues');
      expect(res.testVerification.verified).toBe(true);
    });

    it('transpiles Go source to TypeScript and verifies equivalence', async () => {
      const goSource = `
package solution

func ReverseString(s string) string {
	return s
}
      `.trim();

      const res = await service.transpile({
        sourceCode: goSource,
        sourceLanguage: 'go',
        targetLanguage: 'typescript',
        testCases: [{ input: ['code'], expected: 'code' }],
      });

      expect(res.targetLanguage).toBe('typescript');
      expect(res.transpiledCode).toContain('export function reverseString');
      expect(res.testVerification.verified).toBe(true);
    });

    it('transpiles Rust source to TypeScript and verifies equivalence', async () => {
      const rustSource = `
pub fn get_length(items: Vec<i32>) -> i32 {
    items.len() as i32
}
      `.trim();

      const res = await service.transpile({
        sourceCode: rustSource,
        sourceLanguage: 'rust',
        targetLanguage: 'typescript',
        testCases: [{ input: [[10, 20, 30]], expected: [10, 20, 30] }],
      });

      expect(res.targetLanguage).toBe('typescript');
      expect(res.transpiledCode).toContain('export function getLength');
      expect(res.testVerification.verified).toBe(true);
    });
  });

  describe('Polyglot Challenge Template Database Caching', () => {
    it('caches verified template in PostgreSQL and returns cached version on repeat queries', async () => {
      const challengeId = 'algo_challenge_two_sum';

      prismaMock.challengeTemplate.findUnique.mockResolvedValueOnce(null);
      prismaMock.challengeTemplate.upsert.mockResolvedValueOnce({
        id: 'template_rec_001',
        challengeId,
        language: 'python',
        verified: true,
      });

      const firstPass = await service.transpile({
        sourceCode: sampleTypeScriptTwoSum,
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
        challengeId,
        testCases: twoSumTestCases,
      });

      expect(firstPass.cached).toBe(false);
      expect(prismaMock.challengeTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            challengeId_language: {
              challengeId,
              language: 'python',
            },
          },
        }),
      );

      // Subsequent query returns from cache
      prismaMock.challengeTemplate.findUnique.mockResolvedValueOnce({
        id: 'template_rec_001',
        challengeId,
        language: 'python',
        sourceLanguage: 'typescript',
        functionName: 'two_sum',
        starterCode: firstPass.starterCode,
        solutionCode: firstPass.transpiledCode,
        verified: true,
        astMetadata: {
          signature: firstPass.functionSignature,
          transformations: firstPass.idiomaticTransformations,
          passedTests: 3,
          totalTests: 3,
        },
      });

      const secondPass = await service.transpile({
        sourceCode: sampleTypeScriptTwoSum,
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
        challengeId,
        testCases: twoSumTestCases,
      });

      expect(secondPass.cached).toBe(true);
      expect(secondPass.templateId).toBe('template_rec_001');
    });
  });
});

