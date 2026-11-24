import {
  Injectable,
  Logger,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as vm from 'node:vm';
import * as ts from 'typescript';
import { ChallengeType, Difficulty } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { XpService } from '../xp/xp.service';

export type ProblemStatus =
  | 'DRAFT'
  | 'VERIFYING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED';

export type FuzzCategory =
  | 'EMPTY_STRING'
  | 'NEGATIVE_NUMBER'
  | 'EXTREME_ARRAY'
  | 'MAX_INT'
  | 'MIN_INT'
  | 'UNICODE'
  | 'ZERO_BOUNDARY'
  | 'RANDOM_FUZZ'
  | 'CUSTOM_GENERATED';

export interface PropertyParamSchema {
  name: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'number[]'
    | 'string[]'
    | 'object'
    | 'any';
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  allowNegative?: boolean;
  integerOnly?: boolean;
}

export interface PropertyValidationSchema {
  parameters?: PropertyParamSchema[];
  returnType?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'number[]'
    | 'string[]'
    | 'object'
    | 'void'
    | 'any';
  invariants?: string[]; // e.g. "result !== null", "typeof result === 'number'"
}

export interface AuthorProblemSubmission {
  title: string;
  description: string;
  difficulty?: Difficulty;
  category?: string;
  referenceSolution: string;
  testGeneratorScript?: string;
  validationSchema?: PropertyValidationSchema;
  authorId: string;
  initialXpReward?: number;
}

export interface FuzzingInputCase {
  caseIndex: number;
  category: FuzzCategory;
  inputs: unknown[];
  description: string;
}

export interface FuzzingResult {
  totalCasesExecuted: number;
  passedCases: number;
  failedCases: number;
  timedOutCases: number;
  memoryExceededCases: number;
  executionTimeMs: number;
  firstFailure?: {
    caseIndex: number;
    category: FuzzCategory;
    inputs: unknown[];
    error: string;
  };
  edgeCaseCoverage: {
    emptyStringsTested: boolean;
    negativeNumbersTested: boolean;
    extremeArraysTested: boolean;
    boundaryNumbersTested: boolean;
    unicodeTested: boolean;
  };
}

export interface ProblemQualityScore {
  overallScore: number; // 0 - 100
  testCoveragePercentage: number;
  descriptionClarityScore: number;
  problemNoveltyIndex: number;
  isApproved: boolean;
  rejectionReasons: string[];
}

export interface AuthoredProblemRecord {
  id: string;
  title: string;
  description: string;
  authorId: string;
  difficulty: Difficulty;
  category: string;
  referenceSolution: string;
  testGeneratorScript?: string;
  validationSchema?: PropertyValidationSchema;
  status: ProblemStatus;
  fuzzingResult: FuzzingResult;
  qualityScore: ProblemQualityScore;
  publishedChallengeId?: string;
  usageCount: number;
  royaltiesAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoyaltyAwardResult {
  success: boolean;
  authorId: string;
  problemId: string;
  battleId: string;
  amount: number;
  totalRoyaltiesEarned: number;
  message: string;
}

@Injectable()
export class ProblemAuthoringService {
  private readonly logger = new Logger(ProblemAuthoringService.name);

  // In-memory catalog of authored problems (persisting lifecycle & metrics)
  private readonly authoredProblems = new Map<string, AuthoredProblemRecord>();

  // Lookup map: challengeId -> authoredProblemId
  private readonly challengeToProblemMap = new Map<string, string>();

  public static readonly TARGET_FUZZ_CASES = 1000;
  public static readonly MAX_EXECUTION_TIMEOUT_MS = 1000;
  public static readonly MIN_APPROVAL_SCORE = 70;
  public static readonly DEFAULT_ROYALTY_XP = 50;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly xpService?: XpService,
  ) {}

  /**
   * Submits a community-authored challenge to the automated property-based fuzzing pipeline.
   * Executes 1,000 edge cases, scores quality, and auto-publishes if approved.
   */
  async submitProblem(
    dto: AuthorProblemSubmission,
  ): Promise<AuthoredProblemRecord> {
    if (!dto.title || dto.title.trim().length < 5) {
      throw new BadRequestException(
        'Problem title must be at least 5 characters long.',
      );
    }
    if (!dto.description || dto.description.trim().length < 50) {
      throw new BadRequestException(
        'Problem description must be at least 50 characters long with clear problem context.',
      );
    }
    if (!dto.referenceSolution || !dto.referenceSolution.trim()) {
      throw new BadRequestException(
        'A valid reference solution is required for automated fuzzing.',
      );
    }
    if (!dto.authorId) {
      throw new BadRequestException('authorId is required.');
    }

    const problemId = `prob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const difficulty = dto.difficulty || Difficulty.MEDIUM;
    const category = dto.category || 'ALGORITHMS';

    this.logger.log(
      `Starting automated property-based fuzzing for problem '${dto.title}' (${problemId}) with 1,000 cases...`,
    );

    // 1. Run 1,000 automated property-based fuzzing test cases
    const fuzzingResult = await this.executePropertyFuzzing(
      dto.referenceSolution,
      dto.validationSchema,
      dto.testGeneratorScript,
      ProblemAuthoringService.TARGET_FUZZ_CASES,
    );

    // 2. Score problem quality
    const qualityScore = this.scoreProblemQuality(dto, fuzzingResult);

    // 3. Determine status
    let status: ProblemStatus = qualityScore.isApproved
      ? 'APPROVED'
      : 'REJECTED';
    let publishedChallengeId: string | undefined;

    // 4. Auto-publish if approved
    if (qualityScore.isApproved) {
      try {
        publishedChallengeId = await this.publishToCatalog(
          dto,
          difficulty,
          category,
        );
        status = 'PUBLISHED';
        this.challengeToProblemMap.set(publishedChallengeId, problemId);
        this.logger.log(
          `Successfully auto-published authored problem '${dto.title}' as Challenge ID '${publishedChallengeId}'`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Auto-publishing to database failed, using in-memory catalog: ${err.message}`,
        );
        publishedChallengeId = `challenge_pub_${Date.now()}`;
        status = 'PUBLISHED';
        this.challengeToProblemMap.set(publishedChallengeId, problemId);
      }
    } else {
      this.logger.warn(
        `Problem '${dto.title}' rejected. Reasons: ${qualityScore.rejectionReasons.join('; ')}`,
      );
    }

    const record: AuthoredProblemRecord = {
      id: problemId,
      title: dto.title.trim(),
      description: dto.description.trim(),
      authorId: dto.authorId,
      difficulty,
      category,
      referenceSolution: dto.referenceSolution,
      testGeneratorScript: dto.testGeneratorScript,
      validationSchema: dto.validationSchema,
      status,
      fuzzingResult,
      qualityScore,
      publishedChallengeId,
      usageCount: 0,
      royaltiesAwarded: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.authoredProblems.set(problemId, record);
    return record;
  }

  /**
   * Preview property-based fuzzing execution for authoring IDE without publishing.
   */
  async fuzzPreview(
    referenceSolution: string,
    validationSchema?: PropertyValidationSchema,
    testGeneratorScript?: string,
    count = 100,
  ): Promise<FuzzingResult> {
    if (!referenceSolution || !referenceSolution.trim()) {
      throw new BadRequestException('Reference solution is required for fuzz preview.');
    }
    return this.executePropertyFuzzing(
      referenceSolution,
      validationSchema,
      testGeneratorScript,
      Math.min(Math.max(10, count), 1000),
    );
  }

  /**
   * Executes property-based fuzzing against community-submitted reference code.
   * Generates edge cases (empty strings, negative numbers, extreme arrays) and enforces 1,000ms CPU timeout.
   */
  async executePropertyFuzzing(
    referenceSolution: string,
    schema?: PropertyValidationSchema,
    customGenerator?: string,
    targetCount = ProblemAuthoringService.TARGET_FUZZ_CASES,
  ): Promise<FuzzingResult> {
    const startTime = performance.now();

    // 1. Transpile TypeScript to executable CommonJS
    let executableJs: string;
    try {
      executableJs = this.transpileCode(referenceSolution);
    } catch (err: any) {
      return {
        totalCasesExecuted: 0,
        passedCases: 0,
        failedCases: 1,
        timedOutCases: 0,
        memoryExceededCases: 0,
        executionTimeMs: 0,
        firstFailure: {
          caseIndex: 0,
          category: 'RANDOM_FUZZ',
          inputs: [],
          error: `Transpilation failed: ${err.message}`,
        },
        edgeCaseCoverage: {
          emptyStringsTested: false,
          negativeNumbersTested: false,
          extremeArraysTested: false,
          boundaryNumbersTested: false,
          unicodeTested: false,
        },
      };
    }

    // 2. Generate test cases
    const testCases = this.generateEdgeCases(schema, customGenerator, targetCount);

    // 3. Compile VM Script
    const wrappedCode = `
      "use strict";
      ${executableJs};

      var __candidateFn = null;
      if (typeof solve === 'function') {
        __candidateFn = solve;
      } else if (typeof solution === 'function') {
        __candidateFn = solution;
      } else if (typeof main === 'function') {
        __candidateFn = main;
      } else if (typeof exports === 'object') {
        for (var key in exports) {
          if (typeof exports[key] === 'function') {
            __candidateFn = exports[key];
            break;
          }
        }
      }

      if (typeof __candidateFn !== 'function') {
        throw new Error("No callable entry point ('solve', 'solution', 'main', or exported function) found.");
      }

      __output = __candidateFn(...__inputArgs);
    `;

    let script: vm.Script;
    try {
      script = new vm.Script(wrappedCode, { filename: 'reference-solution.js' });
    } catch (syntaxErr: any) {
      return {
        totalCasesExecuted: 0,
        passedCases: 0,
        failedCases: 1,
        timedOutCases: 0,
        memoryExceededCases: 0,
        executionTimeMs: 0,
        firstFailure: {
          caseIndex: 0,
          category: 'RANDOM_FUZZ',
          inputs: [],
          error: `Syntax Error in reference solution: ${syntaxErr.message}`,
        },
        edgeCaseCoverage: {
          emptyStringsTested: false,
          negativeNumbersTested: false,
          extremeArraysTested: false,
          boundaryNumbersTested: false,
          unicodeTested: false,
        },
      };
    }

    let passedCount = 0;
    let failedCount = 0;
    let timedOutCount = 0;
    let memoryExceededCount = 0;
    let firstFailure: FuzzingResult['firstFailure'];

    const edgeCoverage = {
      emptyStringsTested: false,
      negativeNumbersTested: false,
      extremeArraysTested: false,
      boundaryNumbersTested: false,
      unicodeTested: false,
    };

    // Prepare reusable sandbox context to avoid allocating 1,000 separate V8 contexts
    const sandbox: Record<string, any> = {
      __inputArgs: [],
      __output: undefined,
      console: { log: () => {}, error: () => {}, warn: () => {} },
      Math,
      Number,
      String,
      Array,
      Object,
      Boolean,
      Date,
      RegExp,
      Map,
      Set,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };
    const context = vm.createContext(sandbox);
    const initialHeap = process.memoryUsage().heapUsed;

    // 4. Run test cases sequentially in sandboxed VM
    for (const tc of testCases) {
      // Mark coverage
      if (tc.category === 'EMPTY_STRING') edgeCoverage.emptyStringsTested = true;
      if (tc.category === 'NEGATIVE_NUMBER') edgeCoverage.negativeNumbersTested = true;
      if (tc.category === 'EXTREME_ARRAY') edgeCoverage.extremeArraysTested = true;
      if (
        tc.category === 'MAX_INT' ||
        tc.category === 'MIN_INT' ||
        tc.category === 'ZERO_BOUNDARY'
      ) {
        edgeCoverage.boundaryNumbersTested = true;
      }
      if (tc.category === 'UNICODE') edgeCoverage.unicodeTested = true;

      sandbox.__inputArgs = tc.inputs;
      sandbox.__output = undefined;

      try {
        script.runInContext(context, {
          timeout: ProblemAuthoringService.MAX_EXECUTION_TIMEOUT_MS,
        });

        // Invariant checks if schema specified
        if (schema?.invariants && schema.invariants.length > 0) {
          const result = sandbox.__output;
          for (const inv of schema.invariants) {
            const checkFn = new Function('result', 'args', `return Boolean(${inv});`);
            if (!checkFn(result, tc.inputs)) {
              throw new Error(`Invariant check failed: '${inv}' for result ${JSON.stringify(result)}`);
            }
          }
        }

        passedCount++;
      } catch (runErr: any) {
        failedCount++;
        const isTimeout =
          runErr?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ||
          (runErr?.message && runErr.message.includes('timed out'));

        if (isTimeout) {
          timedOutCount++;
          if (!firstFailure) {
            firstFailure = {
              caseIndex: tc.caseIndex,
              category: tc.category,
              inputs: tc.inputs,
              error: `Execution timed out after 1000ms: infinite loop or catastrophic backtracking detected`,
            };
          }
          // Fast-abort immediately on CPU timeout to protect server resources
          break;
        }

        if (!firstFailure) {
          firstFailure = {
            caseIndex: tc.caseIndex,
            category: tc.category,
            inputs: tc.inputs,
            error: runErr?.message || String(runErr),
          };
        }

        // Fast-abort after 10 failures to avoid wasting CPU cycles
        if (failedCount >= 10) {
          break;
        }
      }

      // Check heap diff to catch runaway memory leaks (threshold 300MB)
      const currentHeap = process.memoryUsage().heapUsed;
      if (currentHeap - initialHeap > 300 * 1024 * 1024) {
        memoryExceededCount++;
        if (!firstFailure) {
          firstFailure = {
            caseIndex: tc.caseIndex,
            category: tc.category,
            inputs: tc.inputs,
            error: 'Memory leak detected: heap allocation exceeded 300MB during test execution.',
          };
        }
        break;
      }
    }

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      totalCasesExecuted: passedCount + failedCount,
      passedCases: passedCount,
      failedCases: failedCount,
      timedOutCases: timedOutCount,
      memoryExceededCases: memoryExceededCount,
      executionTimeMs,
      firstFailure,
      edgeCaseCoverage: edgeCoverage,
    };
  }

  /**
   * Generates edge cases (empty strings, negative numbers, extreme arrays) and property-based inputs up to targetCount.
   */
  generateEdgeCases(
    schema?: PropertyValidationSchema,
    customGenerator?: string,
    targetCount = 1000,
  ): FuzzingInputCase[] {
    const cases: FuzzingInputCase[] = [];
    let idx = 0;

    // Helper to push case
    const addCase = (category: FuzzCategory, inputs: unknown[], desc: string) => {
      if (cases.length < targetCount) {
        cases.push({
          caseIndex: ++idx,
          category,
          inputs,
          description: desc,
        });
      }
    };

    // 1. EMPTY STRINGS & WHITESPACE
    addCase('EMPTY_STRING', [''], 'Empty string');
    addCase('EMPTY_STRING', ['   '], 'Whitespace only string');
    addCase('EMPTY_STRING', ['\t\n\r'], 'Control character whitespace string');
    addCase('EMPTY_STRING', ['', ''], 'Multiple empty string parameters');

    // 2. NEGATIVE NUMBERS & ZERO
    addCase('ZERO_BOUNDARY', [0], 'Zero scalar');
    addCase('NEGATIVE_NUMBER', [-1], 'Negative one');
    addCase('NEGATIVE_NUMBER', [-0], 'Negative zero');
    addCase('NEGATIVE_NUMBER', [-2147483648], '32-bit minimum signed integer');
    addCase('NEGATIVE_NUMBER', [Number.MIN_SAFE_INTEGER], 'JavaScript MIN_SAFE_INTEGER');
    addCase('NEGATIVE_NUMBER', [-999999999], 'Large negative integer');
    addCase('NEGATIVE_NUMBER', [-0.0000001], 'Tiny negative floating point');

    // 3. EXTREME ARRAYS
    addCase('EXTREME_ARRAY', [[]], 'Empty array');
    addCase('EXTREME_ARRAY', [[0]], 'Single zero element array');
    addCase('EXTREME_ARRAY', [[-1]], 'Single negative element array');
    addCase('EXTREME_ARRAY', [[42]], 'Single positive element array');
    addCase('EXTREME_ARRAY', [Array.from({ length: 500 }, (_, i) => i)], 'Monotonically increasing 500 elements');
    addCase('EXTREME_ARRAY', [Array.from({ length: 500 }, (_, i) => 500 - i)], 'Monotonically decreasing 500 elements');
    addCase('EXTREME_ARRAY', [new Array(500).fill(0)], 'Array of 500 identical zeroes');
    addCase('EXTREME_ARRAY', [new Array(500).fill(-99)], 'Array of 500 identical negative numbers');
    addCase('EXTREME_ARRAY', [[Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]], 'Array with safe integer limits');

    // 4. BOUNDARY INTEGERS
    addCase('MAX_INT', [2147483647], '32-bit maximum signed integer');
    addCase('MAX_INT', [Number.MAX_SAFE_INTEGER], 'JavaScript MAX_SAFE_INTEGER');
    addCase('MIN_INT', [Number.MIN_SAFE_INTEGER], 'JavaScript MIN_SAFE_INTEGER');

    // 5. UNICODE & MULTIBYTE STRINGS
    addCase('UNICODE', ['🚀💥🔥✨'], 'Emoji multi-byte unicode string');
    addCase('UNICODE', ['日本語テスト'], 'CJK multi-byte characters');
    addCase('UNICODE', ['مرحبا بالعالم'], 'RTL Arabic text');
    addCase('UNICODE', ['\u0000\u0001\u0002'], 'ASCII null and unprintable controls');

    // 6. Custom generator script evaluation if provided
    if (customGenerator && customGenerator.trim()) {
      try {
        const genFn = new Function('index', customGenerator);
        for (let i = 0; i < 50 && cases.length < targetCount; i++) {
          const generated = genFn(i);
          const args = Array.isArray(generated) ? generated : [generated];
          addCase('CUSTOM_GENERATED', args, `Custom generated input case #${i}`);
        }
      } catch (err: any) {
        this.logger.warn(`Custom test generator error: ${err.message}`);
      }
    }

    // 7. Schema-driven or pseudorandom fuzz generation until targetCount (e.g. 1000)
    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    while (cases.length < targetCount) {
      const r = pseudoRandom();
      let inputVal: unknown[];

      if (schema?.parameters && schema.parameters.length > 0) {
        inputVal = schema.parameters.map((param) => {
          return this.generateValueForParam(param, pseudoRandom);
        });
      } else {
        // Universal mixed input synthesizer
        if (r < 0.25) {
          // Randomized numbers
          const num = Math.floor(pseudoRandom() * 200000) - 100000;
          inputVal = [num];
        } else if (r < 0.5) {
          // Randomized number arrays
          const len = Math.floor(pseudoRandom() * 50);
          const arr = Array.from({ length: len }, () =>
            Math.floor(pseudoRandom() * 2000) - 1000,
          );
          inputVal = [arr];
        } else if (r < 0.75) {
          // Randomized strings
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 _-';
          const len = Math.floor(pseudoRandom() * 30);
          let str = '';
          for (let c = 0; c < len; c++) {
            str += chars[Math.floor(pseudoRandom() * chars.length)];
          }
          inputVal = [str];
        } else {
          // Mixed pair: [array, number]
          const len = Math.floor(pseudoRandom() * 30);
          const arr = Array.from({ length: len }, () =>
            Math.floor(pseudoRandom() * 100),
          );
          const target = Math.floor(pseudoRandom() * 200) - 50;
          inputVal = [arr, target];
        }
      }

      addCase('RANDOM_FUZZ', inputVal, `Randomized property fuzz case #${cases.length + 1}`);
    }

    return cases;
  }

  /**
   * Generates a constrained value adhering to parameter schema.
   */
  private generateValueForParam(
    param: PropertyParamSchema,
    prng: () => number,
  ): unknown {
    const min = param.min ?? (param.allowNegative === false ? 0 : -10000);
    const max = param.max ?? 10000;

    switch (param.type) {
      case 'number': {
        const val = min + prng() * (max - min);
        return param.integerOnly !== false ? Math.round(val) : val;
      }
      case 'number[]': {
        const len = param.allowEmpty === false ? Math.max(1, Math.floor(prng() * 30)) : Math.floor(prng() * 30);
        return Array.from({ length: len }, () => {
          const val = min + prng() * (max - min);
          return param.integerOnly !== false ? Math.round(val) : val;
        });
      }
      case 'string': {
        if (param.allowEmpty !== false && prng() < 0.1) return '';
        const len = Math.floor(prng() * 25) + 1;
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let res = '';
        for (let i = 0; i < len; i++) {
          res += chars[Math.floor(prng() * chars.length)];
        }
        return res;
      }
      case 'string[]': {
        const len = Math.floor(prng() * 10);
        return Array.from({ length: len }, () => 'str_' + Math.floor(prng() * 1000));
      }
      case 'boolean': {
        return prng() > 0.5;
      }
      default:
        return Math.floor(prng() * 100);
    }
  }

  /**
   * Calculates comprehensive problem quality score:
   * - Test coverage percentage
   * - Description clarity score
   * - Problem novelty index
   */
  scoreProblemQuality(
    dto: AuthorProblemSubmission,
    fuzzResult: FuzzingResult,
  ): ProblemQualityScore {
    const rejectionReasons: string[] = [];

    // 1. Test coverage percentage
    let coveredCount = 0;
    const totalCategories = 5;
    const cov = fuzzResult.edgeCaseCoverage;
    if (cov.emptyStringsTested) coveredCount++;
    if (cov.negativeNumbersTested) coveredCount++;
    if (cov.extremeArraysTested) coveredCount++;
    if (cov.boundaryNumbersTested) coveredCount++;
    if (cov.unicodeTested) coveredCount++;

    const testCoveragePercentage = Math.round((coveredCount / totalCategories) * 100);

    // 2. Description clarity score (0 - 100)
    let clarityScore = 0;
    const desc = dto.description || '';
    if (desc.length >= 100) clarityScore += 25;
    if (desc.length >= 250) clarityScore += 15;
    if (/constraints/i.test(desc)) clarityScore += 25;
    if (/example/i.test(desc)) clarityScore += 20;
    if (/```|`[^`]+`/.test(desc)) clarityScore += 15;
    const descriptionClarityScore = Math.min(100, clarityScore);

    // 3. Problem novelty index (0 - 100)
    let noveltyScore = 40; // baseline
    const sol = dto.referenceSolution || '';
    if (/for\s*\(|while\s*\(|\.map\(|\.reduce\(|\.filter\(/.test(sol)) noveltyScore += 15;
    if (/function\s+\w+\s*\(.*,\s*.*\)/.test(sol) || /=>\s*\(.*,.*\)/.test(sol)) noveltyScore += 15;
    if (/Math\.|\.sort\(|new Map|new Set|binarySearch|memo|dp/i.test(sol)) noveltyScore += 15;
    if (sol.length > 80 && sol.length < 2000) noveltyScore += 15;
    const problemNoveltyIndex = Math.min(100, noveltyScore);

    // Check failures, timeouts, and memory leaks
    if (fuzzResult.failedCases > 0) {
      rejectionReasons.push(
        `Failed ${fuzzResult.failedCases} of ${fuzzResult.totalCasesExecuted} fuzzing cases. First error: ${fuzzResult.firstFailure?.error}`,
      );
    }
    if (fuzzResult.timedOutCases > 0) {
      rejectionReasons.push(
        `Exceeded 1,000ms CPU execution timeout in ${fuzzResult.timedOutCases} cases: potential infinite loop.`,
      );
    }
    if (fuzzResult.memoryExceededCases > 0) {
      rejectionReasons.push('Exceeded memory allocation thresholds (potential memory leak).');
    }
    if (descriptionClarityScore < 50) {
      rejectionReasons.push(
        'Description clarity is too low. Ensure examples, constraints, and formatted specifications are provided.',
      );
    }

    // Overall weighted score
    let overallScore = Math.round(
      0.4 * testCoveragePercentage +
        0.3 * descriptionClarityScore +
        0.3 * problemNoveltyIndex,
    );

    // Disqualify if fuzzing crashed or timed out
    if (fuzzResult.failedCases > 0 || fuzzResult.timedOutCases > 0 || fuzzResult.memoryExceededCases > 0) {
      overallScore = Math.min(overallScore, 45);
    }

    const isApproved =
      overallScore >= ProblemAuthoringService.MIN_APPROVAL_SCORE &&
      fuzzResult.failedCases === 0 &&
      fuzzResult.timedOutCases === 0 &&
      fuzzResult.memoryExceededCases === 0;

    return {
      overallScore,
      testCoveragePercentage,
      descriptionClarityScore,
      problemNoveltyIndex,
      isApproved,
      rejectionReasons,
    };
  }

  /**
   * Auto-publishes approved challenge to the community challenge catalog.
   */
  private async publishToCatalog(
    dto: AuthorProblemSubmission,
    difficulty: Difficulty,
    category: string,
  ): Promise<string> {
    if (!this.prisma) {
      return `chal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const created = await this.prisma.challenge.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        type: ChallengeType.DAILY,
        difficulty,
        xpReward: dto.initialXpReward || 150,
        target: 1,
        category,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days active
      },
    });

    return created.id;
  }

  /**
   * Awards problem authors XP royalties when their problem is used in official battles.
   */
  async awardAuthorRoyalty(
    problemIdOrChallengeId: string,
    battleId: string,
    royaltyAmount = ProblemAuthoringService.DEFAULT_ROYALTY_XP,
  ): Promise<RoyaltyAwardResult> {
    // Resolve problem record
    let problem = this.authoredProblems.get(problemIdOrChallengeId);
    if (!problem) {
      const problemId = this.challengeToProblemMap.get(problemIdOrChallengeId);
      if (problemId) {
        problem = this.authoredProblems.get(problemId);
      }
    }

    if (!problem) {
      throw new NotFoundException(
        `Authored problem for ID '${problemIdOrChallengeId}' not found.`,
      );
    }

    problem.usageCount += 1;
    problem.royaltiesAwarded += royaltyAmount;
    problem.updatedAt = new Date();

    let xpAwarded = false;
    if (this.xpService) {
      try {
        await this.xpService.addXp({
          userId: problem.authorId,
          amount: royaltyAmount,
          reason: `Royalty: Community battle challenge '${problem.title}' played in battle ${battleId}`,
          source: 'CHALLENGE_ROYALTY',
        });
        xpAwarded = true;
      } catch (err: any) {
        this.logger.warn(
          `Failed to grant XP via XpService to author ${problem.authorId}: ${err.message}`,
        );
      }
    }

    return {
      success: true,
      authorId: problem.authorId,
      problemId: problem.id,
      battleId,
      amount: royaltyAmount,
      totalRoyaltiesEarned: problem.royaltiesAwarded,
      message: `Successfully awarded ${royaltyAmount} XP royalty to problem author ${problem.authorId} (Battle ${battleId})${xpAwarded ? '' : ' [Simulated]'}.`,
    };
  }

  /**
   * Retrieves an authored problem by ID.
   */
  getAuthoredProblem(problemId: string): AuthoredProblemRecord | undefined {
    return this.authoredProblems.get(problemId);
  }

  /**
   * Lists all authored problems, optionally filtered by authorId.
   */
  listAuthoredProblems(authorId?: string): AuthoredProblemRecord[] {
    const all = Array.from(this.authoredProblems.values());
    if (authorId) {
      return all.filter((p) => p.authorId === authorId);
    }
    return all;
  }

  /**
   * Transpiles TypeScript into executable CommonJS JavaScript.
   */
  private transpileCode(tsCode: string): string {
    const result = ts.transpileModule(tsCode, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        removeComments: false,
      },
    });
    return result.outputText;
  }
}

