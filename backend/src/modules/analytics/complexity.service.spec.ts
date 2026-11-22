import { Test, TestingModule } from '@nestjs/testing';
import { ComplexityService } from './complexity.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ComplexityService & Software Engineering Metrics Suite (#365)', () => {
  let service: ComplexityService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      repositoryComplexity: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'mock-complexity-id', ...data, createdAt: new Date() }),
        ),
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: 'mock-complexity-id',
            repositoryId: where.repositoryId,
            repositoryFullName: 'code-with-abhi-i5/CodePulse',
            branch: 'main',
            commitSha: 'abcdef123456',
            fileCount: 2,
            totalLoc: 150,
            averageComplexity: 12.5,
            maxComplexity: 18,
            averageMaintainability: 62.0,
            totalHalsteadVolume: 4200.5,
            highRiskFunctionsCount: 1,
            fileMetrics: [],
            highRiskFunctions: [
              {
                name: 'processBattleMatch',
                startLine: 10,
                endLine: 80,
                cyclomaticComplexity: 18,
                maintainabilityIndex: 52.4,
                riskLevel: 'HIGH',
                isRefactoringCandidate: true,
                refactoringSuggestions: [
                  'Extract Method: Decompose monolithic function with Cyclomatic Complexity of 18 into atomic helpers.',
                ],
              },
            ],
            createdAt: new Date(),
          }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplexityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ComplexityService>(ComplexityService);
  });

  describe('Cyclomatic Complexity (M = E - N + 2P)', () => {
    it('calculates base complexity of 1 for simple linear code', () => {
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const result = service.analyzeCode({ code });
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].cyclomaticComplexity).toBe(1);
      expect(result.functions[0].riskLevel).toBe('LOW');
      expect(result.functions[0].isRefactoringCandidate).toBe(false);
    });

    it('correctly increments complexity for conditionals, loops, and logical operators', () => {
      const code = `
        function evaluateScore(score: number, bonus: boolean, multiplier?: number): string {
          let total = score;
          if (bonus && multiplier) {          // +1 (if) +1 (&&)
            total = score * (multiplier ?? 1); // +1 (??)
          } else if (bonus || score > 50) {    // +1 (if/else if) +1 (||)
            total += 10;
          }
          
          while (total < 100) {                // +1 (while)
            total += 5;
          }

          for (let i = 0; i < 3; i++) {       // +1 (for)
            total++;
          }

          const grade = total > 90 ? 'A' : 'B'; // +1 (ternary)
          return grade;
        }
      `;
      // Base: 1
      // if: +1
      // &&: +1
      // ??: +1
      // else if: +1
      // ||: +1
      // while: +1
      // for: +1
      // ternary: +1
      // Expected total CC: 1 + 8 = 9
      const result = service.analyzeCode({ code });
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].cyclomaticComplexity).toBe(9);
      expect(result.functions[0].riskLevel).toBe('LOW');
    });

    it('flags high-risk monolithic functions with Cyclomatic Complexity > 15', () => {
      const code = `
        function complexDispatcher(action: string, payload: any): any {
          // Monolithic decision tree
          if (action === 'A') return 1;
          if (action === 'B') return 2;
          if (action === 'C') return 3;
          if (action === 'D') return 4;
          if (action === 'E') return 5;
          if (action === 'F') return 6;
          if (action === 'G') return 7;
          if (action === 'H') return 8;
          if (action === 'I') return 9;
          if (action === 'J') return 10;
          if (action === 'K') return 11;
          if (action === 'L') return 12;
          if (action === 'M') return 13;
          if (action === 'N') return 14;
          if (action === 'O') return 15;
          if (action === 'P') return 16;
          return 0;
        }
      `;
      // Base 1 + 16 ifs = 17 (> 15)
      const result = service.analyzeCode({ code });
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].cyclomaticComplexity).toBeGreaterThanOrEqual(16);
      expect(result.functions[0].isRefactoringCandidate).toBe(true);
      expect(result.functions[0].riskLevel).toBe('HIGH');
      expect(result.highRiskFunctions).toHaveLength(1);
    });
  });

  describe('Halstead Software Science Metrics', () => {
    it('computes distinct and total operators and operands, volume, difficulty, and effort', () => {
      const code = `
        function computeArea(width: number, height: number): number {
          const area = width * height;
          return area;
        }
      `;
      const result = service.analyzeCode({ code });
      const halstead = result.functions[0].halstead;

      expect(halstead.distinctOperators).toBeGreaterThan(0);
      expect(halstead.distinctOperands).toBeGreaterThan(0);
      expect(halstead.totalOperators).toBeGreaterThan(0);
      expect(halstead.totalOperands).toBeGreaterThan(0);
      expect(halstead.programVocabulary).toBe(
        halstead.distinctOperators + halstead.distinctOperands,
      );
      expect(halstead.programLength).toBe(
        halstead.totalOperators + halstead.totalOperands,
      );
      expect(halstead.volume).toBeGreaterThan(0);
      expect(halstead.difficulty).toBeGreaterThan(0);
      expect(halstead.effort).toBeGreaterThan(0);
    });
  });

  describe('Maintainability Index (MI)', () => {
    it('yields high maintainability index (>= 85) for concise clean code', () => {
      const code = `
        function double(n: number): number {
          return n * 2;
        }
      `;
      const result = service.analyzeCode({ code });
      expect(result.functions[0].maintainabilityIndex).toBeGreaterThanOrEqual(85);
      expect(result.functions[0].riskLevel).toBe('LOW');
    });

    it('calculates degraded maintainability index (< 65) for verbose high-complexity code', () => {
      const branches = Array.from(
        { length: 60 },
        (_, i) => `if (x === ${i}) { y += Math.sqrt(x) * ${i} + Math.pow(x, 2); console.log('step', ${i}); }`,
      ).join('\n');
      const code = `
        function spaghetti(x: number): number {
          let y = 0;
          ${branches}
          return y;
        }
      `;
      const result = service.analyzeCode({ code });
      expect(result.functions[0].maintainabilityIndex).toBeLessThan(65);
      expect(result.functions[0].isRefactoringCandidate).toBe(true);
    });
  });

  describe('Refactoring Guidance & Cognitive Hotspots', () => {
    it('generates actionable Extract Method advice for complexity > 15', () => {
      const ifs = Array.from({ length: 18 }, (_, i) => `if (n === ${i}) return ${i};`).join('\n');
      const code = `
        function massiveFunction(n: number): number {
          ${ifs}
          return -1;
        }
      `;
      const result = service.analyzeCode({ code });
      const suggestions = result.functions[0].refactoringSuggestions;

      expect(suggestions.some((s) => s.includes('Extract Method'))).toBe(true);
      expect(suggestions.some((s) => s.includes('Cyclomatic Complexity'))).toBe(true);
    });

    it('generates Guard Clauses recommendation for deeply nested pyramids', () => {
      const code = `
        function nestedPyramid(user: any): boolean {
          if (user) {
            if (user.profile) {
              if (user.profile.active) {
                if (user.profile.verified) {
                  return true;
                }
              }
            }
          }
          return false;
        }
      `;
      const result = service.analyzeCode({ code });
      const suggestions = result.functions[0].refactoringSuggestions;

      expect(suggestions.some((s) => s.includes('Guard Clauses'))).toBe(true);
    });

    it('recommends Strategy Pattern for multi-branch switch/case statements', () => {
      const code = `
        function handleEvent(type: string): void {
          switch (type) {
            case 'START': console.log('start'); break;
            case 'PAUSE': console.log('pause'); break;
            case 'RESUME': console.log('resume'); break;
            case 'STOP': console.log('stop'); break;
            case 'ABORT': console.log('abort'); break;
            default: break;
          }
        }
      `;
      const result = service.analyzeCode({ code });
      const suggestions = result.functions[0].refactoringSuggestions;

      expect(suggestions.some((s) => s.includes('Strategy Pattern'))).toBe(true);
    });
  });

  describe('Multi-Language Support (Python)', () => {
    it('analyzes Python function definitions, cyclomatic complexity, and Halstead volume', () => {
      const pythonCode = `
def process_data(items, active):
    total = 0
    if active and len(items) > 0:
        for item in items:
            if item > 10:
                total += item
            elif item < 0:
                total -= item
    return total
      `;

      const result = service.analyzeFile('process.py', pythonCode, 'python');

      expect(result.language).toBe('python');
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('process_data');
      // Base: 1, if: +1, and: +1, for: +1, if: +1, elif: +1 => CC >= 5
      expect(result.functions[0].cyclomaticComplexity).toBeGreaterThanOrEqual(5);
      expect(result.functions[0].halstead.volume).toBeGreaterThan(0);
      expect(result.functions[0].maintainabilityIndex).toBeGreaterThan(0);
    });
  });

  describe('Batch Analysis & Repository Snapshots', () => {
    it('aggregates file metrics and persists repository complexity snapshot', async () => {
      const files = [
        {
          filePath: 'src/file1.ts',
          content: 'function a(x: number) { if (x > 0) return x; return 0; }',
        },
        {
          filePath: 'src/file2.ts',
          content: 'function b(y: number) { return y * 2; }',
        },
      ];

      const snapshot = await service.createRepositorySnapshot(
        'repo-uuid-123',
        'code-with-abhi-i5/CodePulse',
        files,
        'main',
        'commit-sha-456',
      );

      expect(snapshot.repositoryId).toBe('repo-uuid-123');
      expect(snapshot.fileCount).toBe(2);
      expect(snapshot.averageComplexity).toBeGreaterThan(0);
      expect(snapshot.averageMaintainability).toBeGreaterThan(0);
      expect(mockPrisma.repositoryComplexity.create).toHaveBeenCalled();
    });

    it('retrieves complexity hotspots for a repository', async () => {
      const hotspots = await service.getHotspots('repo-uuid-123');
      expect(hotspots.repositoryId).toBe('repo-uuid-123');
      expect(hotspots.totalHotspots).toBe(1);
      expect(hotspots.highRiskFunctions[0].name).toBe('processBattleMatch');
    });
  });
});
