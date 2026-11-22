import { Injectable, Logger, Optional, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiPersonaDto,
  PersonaDifficultyTier,
  StartPracticeBattleRequestDto,
  PracticeBattleResponseDto,
  PersonaKeystrokeFrameDto,
  SimulateKeystrokesRequestDto,
  FinishPracticeMatchDto,
  FinishPracticeMatchResponseDto,
  ChallengeSummaryDto,
} from './dto/persona-battle.dto';

export const HISTORICAL_PERSONAS: AiPersonaDto[] = [
  {
    id: 'lovelace',
    name: 'Ada Lovelace',
    avatarUrl: 'https://avatars.githubusercontent.com/u/ada-lovelace',
    eloRating: 2150,
    preferredLanguage: 'typescript',
    typingSpeedWpm: 68,
    difficultyTier: PersonaDifficultyTier.LEGENDARY,
    codingStyle: 'Optimal recursive algorithms, analytical purity, and mathematical induction',
    tagline:
      'We may say most aptly that the Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves.',
    systemPrompt:
      'You are Ada Lovelace, the world first computer programmer. Code with uncompromising mathematical precision, elegant recursion, and rigorous invariant proofs.',
  },
  {
    id: 'turing',
    name: 'Alan Turing',
    avatarUrl: 'https://avatars.githubusercontent.com/u/alan-turing',
    eloRating: 2280,
    preferredLanguage: 'python',
    typingSpeedWpm: 74,
    difficultyTier: PersonaDifficultyTier.LEGENDARY,
    codingStyle: 'Deterministic finite automata, cryptographic permutations, and discrete reduction',
    tagline: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.',
    systemPrompt:
      'You are Alan Turing, father of theoretical computer science and AI. Analyze problems via state machine reductions, tape-based determinism, and combinatorial clarity.',
  },
  {
    id: 'carmack',
    name: 'John Carmack',
    avatarUrl: 'https://avatars.githubusercontent.com/u/john-carmack',
    eloRating: 2420,
    preferredLanguage: 'typescript',
    typingSpeedWpm: 118,
    difficultyTier: PersonaDifficultyTier.LEGENDARY,
    codingStyle: 'Fast inverse square root, bit-twiddling, loop unrolling, and SIMD-friendly low-level performance',
    tagline:
      'In the information age, the barriers just aren\'t there. If you want to build something great, nothing is holding you back.',
    systemPrompt:
      'You are John Carmack, legendary engine architect of Doom and Quake. Write blisteringly fast, cache-friendly code with bitwise operations, minimal allocations, and blazing typing speed.',
  },
  {
    id: 'hamilton',
    name: 'Margaret Hamilton',
    avatarUrl: 'https://avatars.githubusercontent.com/u/margaret-hamilton',
    eloRating: 2340,
    preferredLanguage: 'typescript',
    typingSpeedWpm: 82,
    difficultyTier: PersonaDifficultyTier.LEGENDARY,
    codingStyle: 'Apollo 11 guidance style, ultra-defensive assertions, priority asynchronous scheduling, and zero runtime panic',
    tagline: 'There was no second chance. We all knew that.',
    systemPrompt:
      'You are Margaret Hamilton, director of the Apollo Flight Software team. Architect software with asynchronous priority scheduling, comprehensive boundary validation, and zero tolerance for uncaught exceptions.',
  },
];

export const REFERENCE_CHALLENGES: ChallengeSummaryDto[] = [
  {
    id: 'chal-log-fib',
    title: 'Logarithmic Matrix Fibonacci',
    description:
      'Given an integer n, calculate the n-th Fibonacci number in O(log n) time using 2x2 matrix binary exponentiation modulo 1,000,000,007.',
    starterCode: 'function fibonacci(n: number): number {\n  // Implement O(log n) matrix exponentiation\n}\n',
    testCasesCount: 8,
  },
  {
    id: 'chal-bit-popcount',
    title: 'Fast Bitwise Population Count',
    description:
      'Given a 32-bit integer array, return the total count of set bits across all elements using branchless bit manipulation in O(1) auxiliary space.',
    starterCode: 'function totalSetBits(nums: number[]): number {\n  // Implement branchless popcount\n}\n',
    testCasesCount: 8,
  },
  {
    id: 'chal-priority-scheduler',
    title: 'Priority-Driven Asynchronous Task Dispatcher',
    description:
      'Design a priority task dispatcher that executes high-priority telemetry bursts while shedding low-priority background jobs during overload.',
    starterCode: 'function dispatchTasks(tasks: Array<{ id: string; priority: number }>): string[] {\n  // Implement priority scheduler\n}\n',
    testCasesCount: 8,
  },
];

@Injectable()
export class PersonaBattleService {
  private readonly logger = new Logger(PersonaBattleService.name);
  private activePracticeMatches = new Map<string, { persona: AiPersonaDto; challenge: ChallengeSummaryDto }>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Retrieves all available historical programmer personas.
   */
  public async getAvailablePersonas(): Promise<AiPersonaDto[]> {
    // If Prisma has custom personas, merge with built-in historical legends
    if (this.prisma) {
      try {
        const dbPersonas = await (this.prisma as any).aiPersona?.findMany();
        if (dbPersonas && dbPersonas.length > 0) {
          const map = new Map<string, AiPersonaDto>();
          HISTORICAL_PERSONAS.forEach((p) => map.set(p.id, p));
          dbPersonas.forEach((p: any) =>
            map.set(p.id, {
              id: p.id,
              name: p.name,
              avatarUrl: p.avatarUrl,
              eloRating: p.eloRating,
              preferredLanguage: p.preferredLanguage,
              typingSpeedWpm: p.typingSpeedWpm,
              systemPrompt: p.systemPrompt,
              difficultyTier: p.difficultyTier,
              codingStyle: p.codingStyle,
              tagline: p.tagline,
            }),
          );
          return Array.from(map.values());
        }
      } catch (err: any) {
        this.logger.debug(`Could not query database personas: ${err?.message}`);
      }
    }

    return HISTORICAL_PERSONAS;
  }

  /**
   * Retrieves persona by ID.
   */
  public async getPersonaById(personaId: string): Promise<AiPersonaDto> {
    const personas = await this.getAvailablePersonas();
    const found = personas.find(
      (p) => p.id.toLowerCase() === personaId.toLowerCase() || p.name.toLowerCase().includes(personaId.toLowerCase()),
    );
    if (!found) {
      throw new NotFoundException(`AI Persona '${personaId}' not found`);
    }
    return found;
  }

  /**
   * Initiates instant matchmaking (< 2 seconds) against an AI Persona for solo practice.
   */
  public async startPracticeBattle(dto: StartPracticeBattleRequestDto): Promise<PracticeBattleResponseDto> {
    const startTime = Date.now();
    const persona = dto.personaId
      ? await this.getPersonaById(dto.personaId)
      : this.matchPersonaByRating(1500);

    const challenge = dto.challengeId
      ? REFERENCE_CHALLENGES.find((c) => c.id === dto.challengeId) || REFERENCE_CHALLENGES[0]
      : this.selectChallengeForPersona(persona);

    const battleId = `practice-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    this.activePracticeMatches.set(battleId, { persona, challenge });

    // Store in Prisma if available
    if (this.prisma && dto.userId) {
      try {
        await (this.prisma as any).personaBattleMatch?.create({
          data: {
            id: battleId,
            personaId: persona.id,
            userId: dto.userId,
            challengeId: challenge.id,
            status: 'ACTIVE',
            practiceXpAwarded: 0,
          },
        });
      } catch (err: any) {
        this.logger.debug(`Could not persist practice match: ${err?.message}`);
      }
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Instant practice matchmaking created session ${battleId} against ${persona.name} in ${elapsed}ms`,
    );

    return {
      battleId,
      persona,
      challenge,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a realistic keystroke stream with human-like typing micro-delays (150ms-400ms)
   * and occasional typo corrections matching the persona typing cadence.
   */
  public generateKeystrokeStream(
    persona: AiPersonaDto,
    targetCode?: string,
    maxFrames = 100,
  ): PersonaKeystrokeFrameDto[] {
    const code = targetCode || this.getSignatureCodeForPersona(persona);
    const frames: PersonaKeystrokeFrameDto[] = [];

    // Calculate base per-character typing delay from WPM
    // Standard rule: 1 word = 5 characters
    const charsPerMin = Math.max(1, persona.typingSpeedWpm * 5);
    const baseDelayMs = Math.round(60000 / charsPerMin); // e.g., 75 WPM -> 160ms

    let currentBuffer = '';
    const length = Math.min(code.length, maxFrames);

    for (let i = 0; i < length; i++) {
      const char = code[i];

      // Realistic human jitter: variation around base delay (clamped between 150ms and 400ms)
      // Faster for Carmack (100ms - 250ms), slower for deliberate personas
      const minDelay = persona.typingSpeedWpm > 100 ? 100 : 150;
      const maxDelay = persona.typingSpeedWpm > 100 ? 250 : 400;
      const jitter = (Math.random() * 120 - 60);
      let delayMs = Math.round(Math.max(minDelay, Math.min(maxDelay, baseDelayMs + jitter)));

      // Thinking pause on newlines or open braces
      if (char === '\n' || char === '{') {
        delayMs += Math.round(300 + Math.random() * 400);
      }

      // 4% probability of realistic typo followed by immediate backspace correction
      const shouldSimulateTypo = Math.random() < 0.04 && /[a-zA-Z]/.test(char);
      if (shouldSimulateTypo) {
        const typoChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        const typoBuffer = currentBuffer + typoChar;

        // Frame 1: Mistyped character
        frames.push({
          delta: typoChar,
          cursorPosition: typoBuffer.length,
          delayMs: Math.round(80 + Math.random() * 60),
          isTypoCorrection: true,
          codeSnapshot: typoBuffer,
        });

        // Frame 2: Backspace correction
        frames.push({
          delta: '\b',
          cursorPosition: currentBuffer.length,
          delayMs: Math.round(120 + Math.random() * 80),
          isTypoCorrection: true,
          codeSnapshot: currentBuffer,
        });
      }

      // Frame: Correct character
      currentBuffer += char;
      frames.push({
        delta: char,
        cursorPosition: currentBuffer.length,
        delayMs,
        isTypoCorrection: false,
        codeSnapshot: currentBuffer,
      });
    }

    return frames;
  }

  /**
   * Simulates a batch of keystrokes for testing or previewing the persona typing style.
   */
  public async simulateKeystrokes(dto: SimulateKeystrokesRequestDto): Promise<{
    persona: AiPersonaDto;
    framesCount: number;
    averageDelayMs: number;
    frames: PersonaKeystrokeFrameDto[];
  }> {
    const persona = await this.getPersonaById(dto.personaId);
    const frames = this.generateKeystrokeStream(persona, dto.targetCode, dto.frameCount || 60);

    const totalDelay = frames.reduce((acc, f) => acc + f.delayMs, 0);
    const averageDelayMs = frames.length > 0 ? Math.round(totalDelay / frames.length) : 0;

    return {
      persona,
      framesCount: frames.length,
      averageDelayMs,
      frames,
    };
  }

  /**
   * Concludes a solo practice match and awards unranked practice XP.
   */
  public async finishPracticeBattle(dto: FinishPracticeMatchDto): Promise<FinishPracticeMatchResponseDto> {
    const active = this.activePracticeMatches.get(dto.battleId);
    const persona = active?.persona || HISTORICAL_PERSONAS[0];

    // Compute Persona automated score based on persona Elo rating
    // Higher tier personas achieve near-perfect pass rates (e.g. Carmack / Hamilton = 100%)
    const personaAccuracyRatio = Math.min(1.0, 0.75 + (persona.eloRating - 1500) / 4000);
    const personaScore = Math.round(100 * personaAccuracyRatio);

    const userAccuracy = dto.totalTests > 0 ? dto.userPassedTests / dto.totalTests : 0;
    const userScore = Math.round(userAccuracy * 100);

    let winner: 'USER' | 'PERSONA' | 'DRAW' = 'DRAW';
    if (userScore > personaScore) {
      winner = 'USER';
    } else if (personaScore > userScore) {
      winner = 'PERSONA';
    }

    // Award unranked practice XP (Win: 50 XP, Participation: 15 XP)
    const practiceXpAwarded = winner === 'USER' ? 50 : 15;

    if (this.prisma && dto.userId) {
      try {
        await (this.prisma as any).personaBattleMatch?.update({
          where: { id: dto.battleId },
          data: {
            status: 'COMPLETED',
            userScore,
            personaScore,
            winner,
            practiceXpAwarded,
            endedAt: new Date(),
          },
        });

        // Record XP transaction
        await (this.prisma as any).xpTransaction?.create({
          data: {
            userId: dto.userId,
            amount: practiceXpAwarded,
            source: 'BATTLE_PRACTICE_AI',
            description: `Practice Battle vs ${persona.name}: ${winner === 'USER' ? 'Victory' : 'Participation reward'}`,
          },
        });
      } catch (err: any) {
        this.logger.debug(`Could not save practice match results: ${err?.message}`);
      }
    }

    this.activePracticeMatches.delete(dto.battleId);

    const commentary = this.generatePersonaPostGameCommentary(persona, winner);

    return {
      battleId: dto.battleId,
      winner,
      userScore,
      personaScore,
      practiceXpAwarded,
      summary: commentary,
    };
  }

  // =========================================================================
  // Internal Helpers & Persona Styling
  // =========================================================================

  private matchPersonaByRating(userElo: number): AiPersonaDto {
    // Sort by difference to user Elo
    const sorted = [...HISTORICAL_PERSONAS].sort(
      (a, b) => Math.abs(a.eloRating - userElo) - Math.abs(b.eloRating - userElo),
    );
    return sorted[0];
  }

  private selectChallengeForPersona(persona: AiPersonaDto): ChallengeSummaryDto {
    if (persona.id === 'carmack') return REFERENCE_CHALLENGES[1]; // Fast bitwise popcount
    if (persona.id === 'hamilton') return REFERENCE_CHALLENGES[2]; // Priority scheduler
    return REFERENCE_CHALLENGES[0]; // Logarithmic Fibonacci
  }

  private getSignatureCodeForPersona(persona: AiPersonaDto): string {
    switch (persona.id) {
      case 'carmack':
        return `function totalSetBits(nums: number[]): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    let v = nums[i] >>> 0;
    // Branchless bit-parallel popcount
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
  }
  return count;
}`;

      case 'hamilton':
        return `function dispatchTasks(tasks: Array<{ id: string; priority: number }>): string[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  // Defensive priority scheduling with zero runtime exception guarantees
  const validated = tasks.filter(t => t && typeof t.id === 'string' && Number.isFinite(t.priority));
  validated.sort((a, b) => b.priority - a.priority);
  return validated.map(t => t.id);
}`;

      case 'turing':
        return `def state_machine_reduction(tape: str) -> int:
    state = 0
    ones = 0
    for symbol in tape:
        if symbol == '1':
            ones += 1
            state = (state * 2 + 1) % 997
        else:
            state = (state * 2) % 997
    return ones`;

      case 'lovelace':
      default:
        return `function fibonacci(n: number): number {
  if (n <= 0) return 0;
  const MOD = 1000000007;
  let F = [[1, 1], [1, 0]];
  let res = [[1, 0], [0, 1]];
  let p = n - 1;
  while (p > 0) {
    if (p % 2 === 1) res = multiply(res, F, MOD);
    F = multiply(F, F, MOD);
    p = Math.floor(p / 2);
  }
  return res[0][0];
}`;
    }
  }

  private generatePersonaPostGameCommentary(persona: AiPersonaDto, winner: 'USER' | 'PERSONA' | 'DRAW'): string {
    if (winner === 'USER') {
      switch (persona.id) {
        case 'carmack':
          return 'John Carmack: "Fast algorithm. Zero unnecessary allocations. You earned this win."';
        case 'hamilton':
          return 'Margaret Hamilton: "Flawless execution under real-time constraints. Zero runtime exceptions. Exceptional work."';
        case 'turing':
          return 'Alan Turing: "A beautifully elegant reduction. Your computational bounds were superior."';
        case 'lovelace':
        default:
          return 'Ada Lovelace: "An analytical demonstration of algebraic brilliance! Your solution reflects pure mathematical beauty."';
      }
    } else if (winner === 'PERSONA') {
      switch (persona.id) {
        case 'carmack':
          return 'John Carmack: "Good attempt. Watch your inner loop operations and cache locality for more speed next time."';
        case 'hamilton':
          return 'Margaret Hamilton: "Review boundary edge cases. Robustness requires defending against all invalid inputs."';
        case 'turing':
          return 'Alan Turing: "Consider the state transitions more carefully. Keep practicing your discrete proofs."';
        case 'lovelace':
        default:
          return 'Ada Lovelace: "The Engine is unforgiving of arithmetic oversight. Refine your recursion and try once more."';
      }
    }
    return `${persona.name}: "A perfectly matched computational duel. Well played!"`;
  }
}
