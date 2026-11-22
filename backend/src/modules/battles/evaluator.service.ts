import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export interface BattlePerformanceMetrics {
  userId: string;
  testsPassed: number;
  totalTests: number;
  executionTimeMs: number;
  memoryKb: number;
  codeLength: number;
}

export interface CompositeScoreBreakdown {
  userId: string;
  totalScore: number;
  testsPassedScore: number;
  executionSpeedBonus: number;
  memoryPenalty: number;
  codeLengthPenalty: number;
}

export interface TiebreakerEvaluationResult {
  isDraw: boolean;
  winnerId?: string;
  reason: 'TESTS_PASSED' | 'COMPOSITE_SCORE' | 'EXACT_DRAW';
  scores: Record<string, CompositeScoreBreakdown>;
  suddenDeathRequired: boolean;
}

export interface SuddenDeathPuzzle {
  puzzleId: string;
  title: string;
  description: string;
  language: string;
  buggyCode: string;
  testFunction: string;
}

export interface SuddenDeathSession {
  battleId: string;
  puzzle: SuddenDeathPuzzle;
  startedAt: number;
  endsAt: number;
  durationSeconds: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  winnerId?: string;
  timingBreakdown?: {
    winnerId: string;
    timeToSolveMs: number;
    startedAt: number;
    solvedAt: number;
  };
}

export interface KeystrokeVelocityStats {
  userId: string;
  totalKeystrokes: number;
  wpm: number;
  cpm: number;
  burstWpm: number;
  lastKeystrokeAt: number;
}

@Injectable()
export class EvaluatorService {
  private readonly logger = new Logger(EvaluatorService.name);

  // Active Sudden Death sessions per battle
  private suddenDeathSessions: Map<string, SuddenDeathSession> = new Map();

  // Keystroke velocity tracking: Map<battleId:userId, { timestamps: number[] }>
  private keystrokeLogs: Map<string, number[]> = new Map();

  // Micro-puzzles catalog for sudden death
  private readonly puzzles: SuddenDeathPuzzle[] = [
    {
      puzzleId: 'sd-reverse-words',
      title: 'Fix Word Reversal',
      description: 'Fix the bug in the function that reverses the words in a sentence without altering word characters.',
      language: 'typescript',
      buggyCode: `function reverseWords(s) {
  // Bug: reverses all characters instead of word order
  return s.split('').reverse().join('');
}`,
      testFunction: `(function(userCode) {
  const fn = new Function('s', userCode + '; return reverseWords(s);');
  const res = fn('world hello');
  if (res !== 'hello world') throw new Error('Expected "hello world" but got ' + res);
  return true;
})`,
    },
    {
      puzzleId: 'sd-palindrome-filter',
      title: 'Fix Palindrome Filter',
      description: 'Fix the off-by-one and case-sensitivity bug in isAlphaNumericPalindrome.',
      language: 'typescript',
      buggyCode: `function isPalindrome(str) {
  // Bug: missing lowercase normalization and regex replace
  let l = 0, r = str.length;
  while (l < r) {
    if (str[l] !== str[r]) return false;
    l++; r--;
  }
  return true;
}`,
      testFunction: `(function(userCode) {
  const fn = new Function('str', userCode + '; return isPalindrome(str);');
  if (!fn('Racecar')) throw new Error('Failed on "Racecar"');
  if (fn('hello')) throw new Error('Failed on "hello"');
  return true;
})`,
    },
    {
      puzzleId: 'sd-clamp-range',
      title: 'Fix Clamp Value',
      description: 'Fix the inverted ternary condition in clamp(val, min, max).',
      language: 'typescript',
      buggyCode: `function clamp(val, min, max) {
  // Bug: inverted operators
  if (val < min) return max;
  if (val > max) return min;
  return val;
}`,
      testFunction: `(function(userCode) {
  const fn = new Function('val', 'min', 'max', userCode + '; return clamp(val, min, max);');
  if (fn(5, 10, 20) !== 10) throw new Error('Failed min clamp');
  if (fn(25, 10, 20) !== 20) throw new Error('Failed max clamp');
  if (fn(15, 10, 20) !== 15) throw new Error('Failed inside range');
  return true;
})`,
    },
    {
      puzzleId: 'sd-array-dedup',
      title: 'Fix Array Deduplication',
      description: 'Return unique elements while preserving original insertion order.',
      language: 'typescript',
      buggyCode: `function unique(arr) {
  // Bug: returns undefined elements
  return arr.filter((x, i) => arr.indexOf(x) !== i);
}`,
      testFunction: `(function(userCode) {
  const fn = new Function('arr', userCode + '; return unique(arr);');
  const res = fn([1, 2, 2, 3, 1, 4]);
  if (JSON.stringify(res) !== JSON.stringify([1, 2, 3, 4])) throw new Error('Failed dedup check');
  return true;
})`,
    },
  ];

  /**
   * Calculates the composite tiebreaker score:
   * Score = (Total Tests Passed * 1000) + (Execution Speed Bonus) - (Memory Overhead Penalty) - (Code Length Overhead)
   */
  public calculateCompositeScore(metrics: BattlePerformanceMetrics): CompositeScoreBreakdown {
    // 1. Total Tests Passed * 1000
    const testsPassedScore = Math.max(0, metrics.testsPassed) * 1000;

    // 2. Execution Speed Bonus: sub-second execution yields a proportional bonus up to 500 pts
    // Bonus = max(0, 500 - executionTimeMs * 0.5)
    const executionSpeedBonus = Math.max(
      0,
      Math.round(500 - Math.min(1000, metrics.executionTimeMs) * 0.5),
    );

    // 3. Memory Overhead Penalty: 0.1 pts deducted per KB of memory
    const memoryPenalty = Math.max(0, Math.round(metrics.memoryKb * 0.1));

    // 4. Code Length Overhead: 0.05 pts per character (favors conciseness)
    const codeLengthPenalty = Math.max(0, Math.round(metrics.codeLength * 0.05));

    const totalScore =
      testsPassedScore + executionSpeedBonus - memoryPenalty - codeLengthPenalty;

    return {
      userId: metrics.userId,
      totalScore,
      testsPassedScore,
      executionSpeedBonus,
      memoryPenalty,
      codeLengthPenalty,
    };
  }

  /**
   * Evaluates tiebreaker between two competing battle participants.
   * If composite scores are exactly identical, triggers sudden death.
   */
  public evaluateTiebreaker(
    player1Metrics: BattlePerformanceMetrics,
    player2Metrics: BattlePerformanceMetrics,
  ): TiebreakerEvaluationResult {
    // 1. First order tiebreaker: raw passed test cases
    if (player1Metrics.testsPassed > player2Metrics.testsPassed) {
      return {
        isDraw: false,
        winnerId: player1Metrics.userId,
        reason: 'TESTS_PASSED',
        scores: {
          [player1Metrics.userId]: this.calculateCompositeScore(player1Metrics),
          [player2Metrics.userId]: this.calculateCompositeScore(player2Metrics),
        },
        suddenDeathRequired: false,
      };
    } else if (player2Metrics.testsPassed > player1Metrics.testsPassed) {
      return {
        isDraw: false,
        winnerId: player2Metrics.userId,
        reason: 'TESTS_PASSED',
        scores: {
          [player1Metrics.userId]: this.calculateCompositeScore(player1Metrics),
          [player2Metrics.userId]: this.calculateCompositeScore(player2Metrics),
        },
        suddenDeathRequired: false,
      };
    }

    // 2. Second order tiebreaker: composite performance score
    const score1 = this.calculateCompositeScore(player1Metrics);
    const score2 = this.calculateCompositeScore(player2Metrics);

    const scoresMap = {
      [player1Metrics.userId]: score1,
      [player2Metrics.userId]: score2,
    };

    if (score1.totalScore > score2.totalScore) {
      return {
        isDraw: false,
        winnerId: player1Metrics.userId,
        reason: 'COMPOSITE_SCORE',
        scores: scoresMap,
        suddenDeathRequired: false,
      };
    } else if (score2.totalScore > score1.totalScore) {
      return {
        isDraw: false,
        winnerId: player2Metrics.userId,
        reason: 'COMPOSITE_SCORE',
        scores: scoresMap,
        suddenDeathRequired: false,
      };
    }

    // 3. Exact Draw -> Sudden Death required!
    return {
      isDraw: true,
      reason: 'EXACT_DRAW',
      scores: scoresMap,
      suddenDeathRequired: true,
    };
  }

  /**
   * Initiates a 3-minute Sudden Death session with a rapid-fire micro-puzzle.
   */
  public initiateSuddenDeath(battleId: string, customPuzzleId?: string): SuddenDeathSession {
    const puzzle =
      this.puzzles.find((p) => p.puzzleId === customPuzzleId) ||
      this.puzzles[Math.floor(Math.random() * this.puzzles.length)];

    const now = Date.now();
    const durationSeconds = 180; // 3 minutes
    const endsAt = now + durationSeconds * 1000;

    const session: SuddenDeathSession = {
      battleId,
      puzzle,
      startedAt: now,
      endsAt,
      durationSeconds,
      status: 'ACTIVE',
    };

    this.suddenDeathSessions.set(battleId, session);
    this.logger.log(`[Sudden Death] Initiated for battle ${battleId} with puzzle ${puzzle.puzzleId} (ends in 180s)`);
    return session;
  }

  /**
   * Retrieves active sudden death session for a battle.
   */
  public getSuddenDeathSession(battleId: string): SuddenDeathSession | null {
    const session = this.suddenDeathSessions.get(battleId);
    if (!session) return null;

    if (session.status === 'ACTIVE' && Date.now() > session.endsAt) {
      session.status = 'EXPIRED';
    }

    return session;
  }

  /**
   * Evaluates a player's sudden death micro-puzzle code submission.
   * Race condition proof: first player to compile and pass the test wins immediately.
   */
  public submitSuddenDeathSolution(
    battleId: string,
    userId: string,
    code: string,
  ): {
    success: boolean;
    isWinner: boolean;
    error?: string;
    timingBreakdown?: {
      winnerId: string;
      timeToSolveMs: number;
      startedAt: number;
      solvedAt: number;
    };
  } {
    const session = this.getSuddenDeathSession(battleId);
    if (!session) {
      return { success: false, isWinner: false, error: 'No active sudden death session found' };
    }

    if (session.status === 'COMPLETED') {
      return {
        success: false,
        isWinner: false,
        error: `Sudden death already won by ${session.winnerId}`,
      };
    }

    if (session.status === 'EXPIRED') {
      return {
        success: false,
        isWinner: false,
        error: 'Sudden death timer has expired (180s limit reached)',
      };
    }

    // Execute test in isolated VM sandbox
    const evalResult = this.runPuzzleSandbox(session.puzzle, code);
    if (!evalResult.passed) {
      return {
        success: false,
        isWinner: false,
        error: evalResult.error || 'Test assertion failed',
      };
    }

    // First player to compile and pass test wins immediately!
    const now = Date.now();
    const timeToSolveMs = Math.max(1, now - session.startedAt);

    session.status = 'COMPLETED';
    session.winnerId = userId;
    session.timingBreakdown = {
      winnerId: userId,
      timeToSolveMs,
      startedAt: session.startedAt,
      solvedAt: now,
    };

    this.logger.log(
      `[Sudden Death Winner] User ${userId} won battle ${battleId} in ${timeToSolveMs}ms!`,
    );

    return {
      success: true,
      isWinner: true,
      timingBreakdown: session.timingBreakdown,
    };
  }

  /**
   * Executes candidate code against puzzle testFunction inside Node.js VM sandbox.
   */
  public runPuzzleSandbox(
    puzzle: SuddenDeathPuzzle,
    code: string,
  ): { passed: boolean; error?: string } {
    try {
      const sandbox = { userCode: code, result: false };
      const script = new vm.Script(`
        const tester = ${puzzle.testFunction};
        result = tester(userCode);
      `);

      const context = vm.createContext(sandbox);
      script.runInContext(context, { timeout: 1000 });

      return { passed: sandbox.result === true };
    } catch (err: any) {
      return { passed: false, error: err.message || 'Execution error' };
    }
  }

  /**
   * Records a keystroke event and calculates real-time typing velocity (WPM, CPM).
   */
  public recordKeystroke(
    battleId: string,
    userId: string,
    timestamp: number = Date.now(),
  ): KeystrokeVelocityStats {
    const key = `${battleId}:${userId}`;
    let logs = this.keystrokeLogs.get(key);
    if (!logs) {
      logs = [];
      this.keystrokeLogs.set(key, logs);
    }

    logs.push(timestamp);

    // Retain keystrokes within the last 60 seconds for sliding-window WPM
    const oneMinuteAgo = timestamp - 60000;
    while (logs.length > 0 && logs[0] < oneMinuteAgo) {
      logs.shift();
    }

    const totalKeystrokes = logs.length;
    // CPM = characters per minute
    const cpm = totalKeystrokes;
    // Standard WPM = CPM / 5
    const wpm = Math.round(cpm / 5);

    // Burst WPM calculated over the last 5 seconds
    const fiveSecondsAgo = timestamp - 5000;
    const burstCount = logs.filter((t) => t >= fiveSecondsAgo).length;
    const burstWpm = Math.round((burstCount / 5) * 12); // (burstCount / 5 chars) * 12 (5s intervals in a minute)

    return {
      userId,
      totalKeystrokes,
      wpm,
      cpm,
      burstWpm,
      lastKeystrokeAt: timestamp,
    };
  }

  /**
   * Retrieves keystroke velocity statistics for a player in a battle.
   */
  public getKeystrokeVelocity(battleId: string, userId: string): KeystrokeVelocityStats {
    const key = `${battleId}:${userId}`;
    const logs = this.keystrokeLogs.get(key) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const activeLogs = logs.filter((t) => t >= oneMinuteAgo);

    const cpm = activeLogs.length;
    const wpm = Math.round(cpm / 5);
    const fiveSecondsAgo = now - 5000;
    const burstCount = activeLogs.filter((t) => t >= fiveSecondsAgo).length;
    const burstWpm = Math.round((burstCount / 5) * 12);

    return {
      userId,
      totalKeystrokes: logs.length,
      wpm,
      cpm,
      burstWpm,
      lastKeystrokeAt: logs[logs.length - 1] || now,
    };
  }

  /**
   * Resets sessions for testing.
   */
  public clear(): void {
    this.suddenDeathSessions.clear();
    this.keystrokeLogs.clear();
  }
}
