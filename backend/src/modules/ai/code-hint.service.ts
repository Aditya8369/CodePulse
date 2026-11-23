import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HintResponseDto,
  HintTier,
  HintUsageRecord,
  RequestHintDto,
} from './dto/code-hint.dto';

@Injectable()
export class CodeHintService {
  private readonly logger = new Logger(CodeHintService.name);

  // Rate-limiting map: key = `${battleId}:${userId}`, value = timestamp in ms
  private readonly hintCooldowns = new Map<string, number>();

  // Cooldown duration: 2 minutes = 120 seconds
  public static readonly COOLDOWN_SECONDS = 120;
  public static readonly BASE_WINNER_XP = 150;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Generates a progressive algorithmic hint for a player in an active battle.
   */
  async requestHint(dto: RequestHintDto): Promise<HintResponseDto> {
    const { battleId, userId, tier } = dto;

    if (![1, 2, 3].includes(tier)) {
      throw new BadRequestException('Hint tier must be 1, 2, or 3');
    }

    // 1. Rate-limiting check: maximum 1 hint request per 2 minutes
    this.enforceRateLimit(battleId, userId);

    // 2. Fetch battle and problem context if database is available
    let battle: any = null;
    let problemTitle = dto.problemTitle || 'Algorithmic Challenge';
    let problemDescription = dto.problemDescription || '';

    if (this.prisma) {
      try {
        battle = await this.prisma.battle.findUnique({
          where: { id: battleId },
        });
        if (battle && !dto.problemTitle) {
          problemTitle = `Challenge (${battle.category || 'Algorithms'})`;
        }
      } catch (err: any) {
        this.logger.debug(`Could not load battle from DB: ${err.message}`);
      }
    }

    // 3. Calculate time-decay penalty
    const elapsedSeconds = dto.elapsedSeconds ?? 300;
    const totalMatchSeconds = dto.totalMatchSeconds ?? 1200;
    const penaltyInfo = this.calculatePenalty(tier, elapsedSeconds, totalMatchSeconds);

    // 4. Generate hint content based on Tier with strict guardrails
    const { rawMarkdown, tierName } = this.generateTierContent(
      tier,
      problemTitle,
      problemDescription,
      dto.currentCode || '',
      dto.language || 'typescript',
    );

    // 5. Run guardrail sanitizer to prevent solution leaking
    const { cleanedMarkdown, guardrailStatus } = this.sanitizeHintOutput(
      rawMarkdown,
      tier,
    );

    // 6. Record hint usage in Battle record
    const hintRecord: HintUsageRecord = {
      userId,
      tier,
      requestedAt: new Date().toISOString(),
      penaltyPercentage: penaltyInfo.timeDecayedPercent,
      hintSummary: `${tierName} (-${(penaltyInfo.timeDecayedPercent * 100).toFixed(1)}% XP, -${penaltyInfo.estimatedEloPenalty} ELO)`,
      eloPenaltyPoints: penaltyInfo.estimatedEloPenalty,
    };

    if (this.prisma && battle) {
      try {
        await this.recordHintInBattle(battle, userId, hintRecord);
      } catch (err: any) {
        this.logger.warn(`Failed persisting hint record in battle: ${err.message}`);
      }
    }

    // Update cooldown timestamp
    this.hintCooldowns.set(`${battleId}:${userId}`, Date.now());

    const nextAllowedAt = new Date(
      Date.now() + CodeHintService.COOLDOWN_SECONDS * 1000,
    ).toISOString();

    return {
      battleId,
      userId,
      tier,
      tierName,
      hintMarkdown: cleanedMarkdown,
      basePenaltyPercent: penaltyInfo.basePercent,
      timeDecayedPenaltyPercent: penaltyInfo.timeDecayedPercent,
      estimatedXpDeduction: penaltyInfo.estimatedXpDeduction,
      estimatedEloPenalty: penaltyInfo.estimatedEloPenalty,
      cooldownSeconds: CodeHintService.COOLDOWN_SECONDS,
      nextAllowedAt,
      guardrailStatus,
    };
  }

  /**
   * Enforces 2-minute rate-limit cooldown per (battleId, userId).
   */
  public enforceRateLimit(battleId: string, userId: string): void {
    const key = `${battleId}:${userId}`;
    const lastRequest = this.hintCooldowns.get(key);

    if (lastRequest) {
      const elapsedMs = Date.now() - lastRequest;
      const cooldownMs = CodeHintService.COOLDOWN_SECONDS * 1000;

      if (elapsedMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        throw new BadRequestException(
          `Hint rate-limit active. Please wait ${remainingSeconds} seconds before requesting another hint.`,
        );
      }
    }
  }

  /**
   * Calculates progressive XP penalty with time-decay adjustment.
   *
   * Base penalties:
   * - Tier 1: 10%
   * - Tier 2: 25%
   * - Tier 3: 40%
   *
   * Time-decay:
   * Requests made after significant elapsed match time incur lower penalty down to a 60% floor.
   */
  public calculatePenalty(
    tier: number,
    elapsedSeconds: number = 300,
    totalMatchSeconds: number = 1200,
  ): {
    basePercent: number;
    timeDecayedPercent: number;
    estimatedXpDeduction: number;
    estimatedEloPenalty: number;
  } {
    let basePercent = 0.1;
    if (tier === 2) basePercent = 0.25;
    if (tier === 3) basePercent = 0.4;

    const safeTotal = Math.max(totalMatchSeconds, 60);
    const safeElapsed = Math.min(Math.max(elapsedSeconds, 0), safeTotal);
    const timeRatio = safeElapsed / safeTotal;

    // Decay multiplier: from 1.0 (at start of match) down to 0.6 (late in match)
    const decayMultiplier = Math.max(0.6, 1 - timeRatio * 0.4);
    const timeDecayedPercent = Number((basePercent * decayMultiplier).toFixed(3));

    const estimatedXpDeduction = Math.round(
      CodeHintService.BASE_WINNER_XP * timeDecayedPercent,
    );
    const estimatedEloPenalty = Math.max(1, Math.round(25 * timeDecayedPercent));

    return {
      basePercent,
      timeDecayedPercent,
      estimatedXpDeduction,
      estimatedEloPenalty,
    };
  }

  /**
   * Calculates net victory XP after applying all accumulated hint penalties.
   */
  public calculateNetXp(
    baseXp: number,
    hintRecords: HintUsageRecord[] = [],
  ): {
    netXp: number;
    totalPenaltyPercent: number;
    totalDeduction: number;
  } {
    if (!hintRecords || hintRecords.length === 0) {
      return { netXp: baseXp, totalPenaltyPercent: 0, totalDeduction: 0 };
    }

    // Cumulative penalty capped at 75% max deduction
    const rawPenalty = hintRecords.reduce(
      (sum, r) => sum + (r.penaltyPercentage || 0),
      0,
    );
    const totalPenaltyPercent = Math.min(0.75, Number(rawPenalty.toFixed(3)));
    const netXp = Math.max(0, Math.round(baseXp * (1 - totalPenaltyPercent)));
    const totalDeduction = baseXp - netXp;

    return {
      netXp,
      totalPenaltyPercent,
      totalDeduction,
    };
  }

  /**
   * Applies hint penalties atomically to a battle upon match conclusion.
   */
  async applyHintPenaltiesAtMatchFinish(
    battleId: string,
    winnerId: string,
    baseWinnerXp: number = CodeHintService.BASE_WINNER_XP,
  ): Promise<{
    finalWinnerXp: number;
    penaltyApplied: number;
    hintsUsedCount: number;
  }> {
    if (!this.prisma) {
      return {
        finalWinnerXp: baseWinnerXp,
        penaltyApplied: 0,
        hintsUsedCount: 0,
      };
    }

    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
    });

    if (!battle) {
      throw new NotFoundException(`Battle ${battleId} not found`);
    }

    const isChallenger = battle.challengerId === winnerId;
    const penaltyRate = isChallenger
      ? (battle as any).challengerXpPenalty || 0
      : (battle as any).opponentXpPenalty || 0;

    const history: HintUsageRecord[] = ((battle as any).hintHistory as any) || [];
    const winnerHints = history.filter((h) => h.userId === winnerId);

    const deduction = Math.round(baseWinnerXp * penaltyRate);
    const finalWinnerXp = Math.max(25, baseWinnerXp - deduction); // minimum 25 XP participation floor

    return {
      finalWinnerXp,
      penaltyApplied: deduction,
      hintsUsedCount: winnerHints.length,
    };
  }

  /**
   * Generates tier-specific hint content.
   */
  private generateTierContent(
    tier: number,
    title: string,
    description: string,
    code: string,
    language: string,
  ): { rawMarkdown: string; tierName: string } {
    const identifiedPattern = this.detectAlgorithmicPattern(title, description, code);

    if (tier === 1) {
      return {
        tierName: 'Conceptual Direction',
        rawMarkdown: this.buildTier1Markdown(title, identifiedPattern),
      };
    } else if (tier === 2) {
      return {
        tierName: 'Pseudocode Scaffold',
        rawMarkdown: this.buildTier2Markdown(title, identifiedPattern),
      };
    } else {
      return {
        tierName: 'Specific Edge-Case Advice',
        rawMarkdown: this.buildTier3Markdown(title, code, identifiedPattern),
      };
    }
  }

  /**
   * Tier 1: Conceptual Direction (10% XP penalty)
   * Strictly no code, no pseudocode. Algorithmic intuition and state framing.
   */
  private buildTier1Markdown(title: string, pattern: string): string {
    return [
      `### 💡 Tier 1: Conceptual Direction — ${title}`,
      `**Algorithmic Paradigm:** \`${pattern}\``,
      '',
      `#### Strategic Intuition`,
      `- **State Formulation:** Rather than a brute-force approach with high time complexity, model the problem state using **${pattern}**.`,
      `- **Optimal Substructure:** Observe how decisions at each step narrow the remaining search space monotonically.`,
      `- **Invariant to Maintain:** Ensure that at every iteration, the elements outside your active window or boundary are already certified as optimal or discarded.`,
      '',
      `> ℹ️ *Penalty applied: 10% victory XP deduction. Try implementing the core loop based on this conceptual model.*`,
    ].join('\n');
  }

  /**
   * Tier 2: Pseudocode Scaffold (25% XP penalty)
   * High-level structural pseudocode scaffold without runnable language code.
   */
  private buildTier2Markdown(title: string, pattern: string): string {
    return [
      `### 📐 Tier 2: Pseudocode Scaffold — ${title}`,
      `**Structure:** High-Level Language-Agnostic Flow`,
      '',
      '```text',
      'ALGORITHM Scaffold:',
      '  Input: data collection D, target T',
      '  Initialize state pointers / memoization table',
      '  ',
      '  WHILE termination condition is not met DO:',
      '    CurrentMetric = evaluate(pointers or window)',
      '    IF CurrentMetric equals T THEN:',
      '      RECORD / RETURN valid solution coordinates',
      '    ELSE IF CurrentMetric exceeds target THEN:',
      '      ADJUST upper boundary inward (shrink search space)',
      '    ELSE:',
      '      ADVANCE lower boundary inward (expand search space)',
      '  END WHILE',
      '  ',
      '  RETURN default fallback if no candidate satisfies constraints',
      '```',
      '',
      `> ⚠️ *Penalty applied: 25% victory XP deduction. Flesh out this scaffold with your problem-specific conditions.*`,
    ].join('\n');
  }

  /**
   * Tier 3: Specific Edge-Case Advice (40% XP penalty)
   * Pinpoints common algorithmic pitfalls and draft code traps.
   */
  private buildTier3Markdown(title: string, code: string, pattern: string): string {
    const hasLoops = /for\s*\(|while\s*\(/.test(code);
    const hasReturn = /return\b/.test(code);
    const hasArrays = /\[|array|nums|arr/i.test(code + title);

    const traps: string[] = [];
    if (!hasLoops) {
      traps.push('- **Missing Iteration Structure:** Your draft does not yet have an active loop or recursive step.');
    }
    if (!hasReturn) {
      traps.push('- **Return Missing:** Ensure every branch returns a deterministic value (avoiding implicit undefined/null).');
    }
    if (hasArrays) {
      traps.push('- **Boundary Off-By-One:** Check array bounds at `index === 0` and `index === length - 1`.');
      traps.push('- **Duplicate Elements:** If identical values appear consecutively, determine if they need skipping to prevent redundant evaluations.');
    }
    traps.push('- **Empty / Minimal Input:** Verify your logic when input size is 0 or 1.');
    traps.push('- **Negative Values & Zero:** Does your comparison assumption break when negative integers are provided?');

    return [
      `### 🔍 Tier 3: Specific Edge-Case Advice — ${title}`,
      `**Targeted Pitfall Inspection & Boundary Hardening**`,
      '',
      `#### Common Traps in Your Current Approach:`,
      ...traps,
      '',
      `#### Verification Checklist:`,
      `1. Are pointer updates guaranteed to make strict progress toward termination?`,
      `2. Is the time complexity bounded by $O(N)$ or $O(N \\log N)$ to avoid Time Limit Exceeded (TLE)?`,
      `3. Does the solution allocate minimal auxiliary memory to avoid memory limit crashes?`,
      '',
      `> 🛑 *Penalty applied: 40% victory XP deduction. Apply edge-case guards to pass remaining test suites.*`,
    ].join('\n');
  }

  /**
   * Strict Guardrail Sanitizer:
   * Analyzes generated hint text and strictly strips or sanitizes any raw, runnable solution code.
   */
  public sanitizeHintOutput(
    rawText: string,
    tier: number,
  ): { cleanedMarkdown: string; guardrailStatus: 'PASS' | 'FILTERED' } {
    let cleaned = rawText;
    let filtered = false;

    // Reject runnable function declarations in popular languages (JS/TS, Python, Go, Rust, Java, C++)
    const forbiddenPatterns = [
      /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
      /def\s+\w+\s*\([^)]*\)\s*:[\s\S]*?(?=\n\S|\Z)/gi,
      /(?:pub\s+)?fn\s+\w+\s*\([^)]*\)\s*(?:->\s*[^{]+)?\{[\s\S]*?\}/gi,
      /func\s+\w+\s*\([^)]*\)\s*[^{]*\{[\s\S]*?\}/gi,
      /(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
      /class\s+Solution[\s\S]*?\}/gi,
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}/gi,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(
          pattern,
          '/* [SOLUTION CODE BLOCKED BY AI GUARDRAILS - CONCEPTUAL HINT PRESERVED] */',
        );
        filtered = true;
      }
    }

    // Tier 1 must never contain fenced code blocks
    if (tier === 1 && cleaned.includes('```')) {
      cleaned = cleaned.replace(/```[\s\S]*?```/g, '[Code blocked in Tier 1 Conceptual Mode]');
      filtered = true;
    }

    return {
      cleanedMarkdown: cleaned,
      guardrailStatus: filtered ? 'FILTERED' : 'PASS',
    };
  }

  /**
   * Algorithmic pattern detector helper
   */
  private detectAlgorithmicPattern(title: string, desc: string, code: string): string {
    const combined = `${title} ${desc} ${code}`.toLowerCase();

    if (combined.includes('sort') || combined.includes('two sum') || combined.includes('pointer')) {
      return 'Two Pointers & Sorted Convergence';
    }
    if (combined.includes('window') || combined.includes('substring') || combined.includes('subarray')) {
      return 'Sliding Window (Dynamic Boundary)';
    }
    if (combined.includes('stack') || combined.includes('next greater') || combined.includes('parenthes')) {
      return 'Monotonic Stack';
    }
    if (combined.includes('tree') || combined.includes('graph') || combined.includes('path') || combined.includes('bfs')) {
      return 'Breadth-First Search / Depth-First Traversal';
    }
    if (combined.includes('dp') || combined.includes('knapsack') || combined.includes('subsequence')) {
      return 'Dynamic Programming (Memoized Tabulation)';
    }
    if (combined.includes('binary search') || combined.includes('log')) {
      return 'Binary Search (Logarithmic Bisection)';
    }

    return 'Greedy Invariant Optimization';
  }

  /**
   * Persists hint usage in Battle model
   */
  private async recordHintInBattle(
    battle: any,
    userId: string,
    record: HintUsageRecord,
  ): Promise<void> {
    if (!this.prisma) return;

    const isChallenger = battle.challengerId === userId;
    const currentHistory: HintUsageRecord[] = (battle.hintHistory as any) || [];
    const updatedHistory = [...currentHistory, record];

    const userHints = updatedHistory.filter((h) => h.userId === userId);
    const accumulatedPenalty = Math.min(
      0.75,
      Number(userHints.reduce((sum, h) => sum + h.penaltyPercentage, 0).toFixed(3)),
    );

    const updateData: any = {
      hintHistory: updatedHistory,
    };

    if (isChallenger) {
      updateData.challengerXpPenalty = accumulatedPenalty;
    } else {
      updateData.opponentXpPenalty = accumulatedPenalty;
    }

    await this.prisma.battle.update({
      where: { id: battle.id },
      data: updateData,
    });
  }

  /**
   * Helper for tests: clears cooldowns
   */
  public resetCooldowns(): void {
    this.hintCooldowns.clear();
  }
}
