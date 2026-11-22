import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlagiarismMatchDetail {
  source: 'OPPONENT' | 'TEMPLATE' | 'HISTORICAL' | 'NONE';
  similarityScore: number;
  matchedId?: string;
  matchedUserId?: string;
  sharedFingerprintsCount: number;
}

export interface PlagiarismDiffOverlay {
  lineIndexA?: number;
  lineIndexB?: number;
  contentA?: string;
  contentB?: string;
  isMatched: boolean;
}

export interface PlagiarismReport {
  battleId: string;
  userId: string;
  flagged: boolean;
  similarityScore: number;
  threshold: number;
  matchedSource: 'OPPONENT' | 'TEMPLATE' | 'HISTORICAL' | 'NONE';
  matchedUserId?: string;
  matchedSubmissionId?: string;
  tokensCount: number;
  fingerprintsCount: number;
  sharedFingerprintsCount: number;
  executionTimeMs: number;
  diffOverlay: PlagiarismDiffOverlay[];
  nullifyEloRecommended: boolean;
  detectedAt: Date;
}

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);

  // Plagiarism suspicion threshold (85% similarity)
  public static readonly SUSPICIOUS_THRESHOLD = 85.0;

  // Language keywords for structural AST preservation
  private readonly KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'function', 'def', 'class', 'let', 'const', 'var',
    'import', 'from', 'export', 'as', 'async', 'await', 'try', 'catch',
    'finally', 'throw', 'new', 'in', 'of', 'instanceof', 'typeof', 'yield',
    'void', 'delete', 'with', 'debugger', 'pass', 'lambda', 'elif', 'is',
    'not', 'and', 'or', 'global', 'nonlocal', 'assert', 'raise', 'print',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AST Normalization & Tokenization:
   * Strips comments, whitespace, and formatting.
   * Normalizes variable identifiers, string literals, and numbers into generic canonical tokens.
   */
  public normalizeAndTokenize(sourceCode: string, language = 'typescript'): string[] {
    if (!sourceCode || typeof sourceCode !== 'string') {
      return [];
    }

    // 1. Remove comments and docstrings
    let cleaned = sourceCode;

    // Python multiline docstrings
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');

    // C/JS/TS multiline comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Single line comments (// or #)
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/#.*$/gm, '');

    // 2. Lexical Tokenization using RegExp matching identifiers, keywords, literals, and operators
    const tokenRegex =
      /([a-zA-Z_$][a-zA-Z0-9_$]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(===|!==|==|!=|<=|>=|=>|->|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||<<|>>|[+\-*\/%&|^~!=<>?:.,;()[\]{}])/g;

    const rawTokens: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(cleaned)) !== null) {
      const [, identifier, stringLit, numberLit, operator] = match;

      if (identifier) {
        rawTokens.push(identifier);
      } else if (stringLit) {
        rawTokens.push('__STR__');
      } else if (numberLit) {
        rawTokens.push('__NUM__');
      } else if (operator) {
        rawTokens.push(operator);
      }
    }

    // 3. Structural Identifier Renaming Normalization
    // Variables/functions are assigned canonical sequential IDs (ID_0, ID_1, ...)
    // based on first appearance order to ensure variable-renaming invariance.
    const identifierMap = new Map<string, string>();
    let idCounter = 0;

    const normalizedTokens: string[] = rawTokens.map((tok) => {
      if (this.KEYWORDS.has(tok)) {
        return tok;
      }
      if (tok === '__STR__' || tok === '__NUM__') {
        return tok;
      }
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(tok)) {
        if (!identifierMap.has(tok)) {
          identifierMap.set(tok, `ID_${idCounter++}`);
        }
        return identifierMap.get(tok)!;
      }
      return tok;
    });

    return normalizedTokens;
  }

  /**
   * N-Gram Winnowing Fingerprinting Algorithm:
   * Generates bounded, deterministic hashes of structural code shingles.
   *
   * @param tokens Array of normalized AST tokens
   * @param k Shingle size (default 5 tokens)
   * @param w Sliding window size (default 4 shingles)
   */
  public computeWinnowingFingerprints(
    tokens: string[],
    k = 5,
    w = 4,
  ): string[] {
    if (tokens.length < k) {
      if (tokens.length === 0) return [];
      const hash = this.hashGram(tokens.join(' '));
      return [hash.toString(16)];
    }

    // 1. Generate k-gram hashes
    const hashes: number[] = [];
    for (let i = 0; i <= tokens.length - k; i++) {
      const shingle = tokens.slice(i, i + k).join(' ');
      hashes.push(this.hashGram(shingle));
    }

    // 2. Winnowing sliding window: select minimum in each window [i, i + w - 1]
    const fingerprints = new Set<string>();

    if (hashes.length < w) {
      let minHash = hashes[0];
      for (const h of hashes) {
        if (h <= minHash) minHash = h;
      }
      fingerprints.add(minHash.toString(16));
      return Array.from(fingerprints);
    }

    for (let i = 0; i <= hashes.length - w; i++) {
      let minHash = hashes[i];
      let minPos = i;

      for (let j = 1; j < w; j++) {
        const cur = hashes[i + j];
        // Break ties by choosing the rightmost minimum
        if (cur <= minHash) {
          minHash = cur;
          minPos = i + j;
        }
      }

      fingerprints.add(minHash.toString(16));
    }

    return Array.from(fingerprints);
  }

  /**
   * Computes Jaccard and Containment similarity between two tokenized solutions.
   */
  public calculateSimilarity(
    tokensA: string[],
    tokensB: string[],
    k = 5,
    w = 4,
  ): {
    similarityScore: number;
    jaccard: number;
    containment: number;
    sharedFingerprints: string[];
    totalFingerprintsA: number;
    totalFingerprintsB: number;
  } {
    const fpsA = this.computeWinnowingFingerprints(tokensA, k, w);
    const fpsB = this.computeWinnowingFingerprints(tokensB, k, w);

    if (fpsA.length === 0 && fpsB.length === 0) {
      return {
        similarityScore: 0,
        jaccard: 0,
        containment: 0,
        sharedFingerprints: [],
        totalFingerprintsA: 0,
        totalFingerprintsB: 0,
      };
    }

    if (fpsA.length === 0 || fpsB.length === 0) {
      return {
        similarityScore: 0,
        jaccard: 0,
        containment: 0,
        sharedFingerprints: [],
        totalFingerprintsA: fpsA.length,
        totalFingerprintsB: fpsB.length,
      };
    }

    const setA = new Set(fpsA);
    const setB = new Set(fpsB);

    const intersection: string[] = [];
    for (const fp of setA) {
      if (setB.has(fp)) {
        intersection.push(fp);
      }
    }

    const unionSize = new Set([...fpsA, ...fpsB]).size;
    const jaccard = unionSize > 0 ? intersection.length / unionSize : 0;
    const minSize = Math.min(setA.size, setB.size);
    const containment = minSize > 0 ? intersection.length / minSize : 0;

    // The score is the maximum of Jaccard and Containment (percentage 0 to 100)
    const score = Math.round(Math.max(jaccard, containment) * 1000) / 10;

    return {
      similarityScore: score,
      jaccard: Math.round(jaccard * 1000) / 10,
      containment: Math.round(containment * 1000) / 10,
      sharedFingerprints: intersection,
      totalFingerprintsA: setA.size,
      totalFingerprintsB: setB.size,
    };
  }

  /**
   * Compares submitted battle solution against:
   * (a) Opponent's solution
   * (b) Standard problem template
   * (c) Historical database of passed submissions
   *
   * Executes asynchronously in under 500ms post-match submission.
   */
  public async analyzeBattleSubmission(params: {
    battleId: string;
    userId: string;
    code: string;
    language?: string;
    opponentCode?: string;
    opponentUserId?: string;
    standardTemplate?: string;
  }): Promise<PlagiarismReport> {
    const startTime = Date.now();
    const { battleId, userId, code, language = 'typescript', opponentCode, opponentUserId, standardTemplate } = params;

    const tokens = this.normalizeAndTokenize(code, language);
    const fingerprints = this.computeWinnowingFingerprints(tokens);

    let maxSimilarity = 0;
    let matchedSource: 'OPPONENT' | 'TEMPLATE' | 'HISTORICAL' | 'NONE' = 'NONE';
    let matchedUserId: string | undefined;
    let matchedSubmissionId: string | undefined;
    let sharedFps: string[] = [];

    // (a) Compare against opponent's solution
    if (opponentCode) {
      const oppTokens = this.normalizeAndTokenize(opponentCode, language);
      const res = this.calculateSimilarity(tokens, oppTokens);

      if (res.similarityScore > maxSimilarity) {
        maxSimilarity = res.similarityScore;
        matchedSource = 'OPPONENT';
        matchedUserId = opponentUserId;
        sharedFps = res.sharedFingerprints;
      }
    }

    // (b) Compare against standard solution template
    if (standardTemplate) {
      const tmplTokens = this.normalizeAndTokenize(standardTemplate, language);
      const res = this.calculateSimilarity(tokens, tmplTokens);

      if (res.similarityScore > maxSimilarity) {
        maxSimilarity = res.similarityScore;
        matchedSource = 'TEMPLATE';
        matchedUserId = undefined;
        sharedFps = res.sharedFingerprints;
      }
    }

    // (c) Compare against historical database of passed submissions
    try {
      if (this.prisma?.battleSubmission?.findMany) {
        const historicalSubmissions = await this.prisma.battleSubmission.findMany({
          where: {
            battleId: { not: battleId },
            flagged: false,
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        });

        for (const hist of historicalSubmissions) {
          if (!hist.code || hist.userId === userId) continue;
          const histTokens = this.normalizeAndTokenize(hist.code, hist.language || language);
          const res = this.calculateSimilarity(tokens, histTokens);

          if (res.similarityScore > maxSimilarity) {
            maxSimilarity = res.similarityScore;
            matchedSource = 'HISTORICAL';
            matchedUserId = hist.userId;
            matchedSubmissionId = hist.id;
            sharedFps = res.sharedFingerprints;
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not query historical submissions: ${err?.message}`);
    }

    const flagged = maxSimilarity >= PlagiarismService.SUSPICIOUS_THRESHOLD;
    const elapsedMs = Date.now() - startTime;

    // Generate diff overlay for administrative review
    const diffOverlay = this.generateDiffOverlay(
      code,
      opponentCode || standardTemplate || '',
    );

    const report: PlagiarismReport = {
      battleId,
      userId,
      flagged,
      similarityScore: maxSimilarity,
      threshold: PlagiarismService.SUSPICIOUS_THRESHOLD,
      matchedSource,
      matchedUserId,
      matchedSubmissionId,
      tokensCount: tokens.length,
      fingerprintsCount: fingerprints.length,
      sharedFingerprintsCount: sharedFps.length,
      executionTimeMs: elapsedMs,
      diffOverlay,
      nullifyEloRecommended: flagged,
      detectedAt: new Date(),
    };

    // Asynchronously record submission and update battle record
    await this.persistSubmissionAndFlagBattle(report, code, language, fingerprints);

    if (flagged) {
      this.logger.warn(
        `[PLAGIARISM ALERT] Battle ${battleId} flagged! User ${userId} code matches ${matchedSource} with similarity ${maxSimilarity}% (Threshold: ${PlagiarismService.SUSPICIOUS_THRESHOLD}%). Elo rating nullification recommended.`,
      );
    }

    return report;
  }

  /**
   * Retrieves plagiarism report and submitted solution logs for a given battle.
   */
  public async getPlagiarismReportForBattle(battleId: string) {
    if (!this.prisma?.battle?.findUnique) {
      return {
        battleId,
        flaggedForPlagiarism: false,
        similarityScore: 0,
        plagiarismDetails: null,
        submissionsCount: 0,
        submissions: [],
      };
    }

    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        submissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!battle) {
      return null;
    }

    return {
      battleId: battle.id,
      flaggedForPlagiarism: battle.flaggedForPlagiarism,
      similarityScore: battle.similarityScore ?? 0,
      plagiarismDetails: battle.plagiarismDetails,
      submissionsCount: battle.submissions?.length ?? 0,
      submissions: battle.submissions ?? [],
    };
  }

  /**
   * Persists battle submission and updates Battle record flags in database.
   */
  private async persistSubmissionAndFlagBattle(
    report: PlagiarismReport,
    code: string,
    language: string,
    fingerprints: string[],
  ): Promise<void> {
    try {
      if (this.prisma?.battleSubmission?.create) {
        await this.prisma.battleSubmission.create({
          data: {
            battleId: report.battleId,
            userId: report.userId,
            code,
            language,
            tokensCount: report.tokensCount,
            fingerprints,
            similarityScore: report.similarityScore,
            flagged: report.flagged,
          },
        });
      }

      if (report.flagged && this.prisma?.battle?.update) {
        await this.prisma.battle.update({
          where: { id: report.battleId },
          data: {
            flaggedForPlagiarism: true,
            similarityScore: report.similarityScore,
            plagiarismDetails: report as any,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to persist battle submission or flag battle: ${err?.message}`);
    }
  }

  /**
   * Generates line-by-line diff overlays for side-by-side administrative review.
   */
  public generateDiffOverlay(codeA: string, codeB: string): PlagiarismDiffOverlay[] {
    const linesA = codeA.split('\n');
    const linesB = codeB.split('\n');
    const maxLines = Math.max(linesA.length, linesB.length);

    const overlays: PlagiarismDiffOverlay[] = [];

    for (let i = 0; i < maxLines; i++) {
      const lineA = linesA[i] || '';
      const lineB = linesB[i] || '';

      const normA = lineA.trim().replace(/\s+/g, '');
      const normB = lineB.trim().replace(/\s+/g, '');
      const isMatched = normA.length > 3 && normB.length > 3 && normA === normB;

      overlays.push({
        lineIndexA: i < linesA.length ? i + 1 : undefined,
        lineIndexB: i < linesB.length ? i + 1 : undefined,
        contentA: lineA,
        contentB: lineB,
        isMatched,
      });
    }

    return overlays;
  }

  /**
   * FNV-1a 32-bit polynomial string hashing.
   */
  private hashGram(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

