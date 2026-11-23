import { Injectable, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface KeystrokeTimingEvent {
  timestampMs: number;
  isBackspace: boolean;
  lineNumber?: number;
}

export interface CompileErrorEvent {
  timestampMs: number;
  errorCode: string;
  normalizedMessage: string;
  filePath: string;
  astNodeCount: number; // Tracks whether semantic code progression occurred
}

export interface CompileThrashingLoop {
  errorSignature: string;
  filePath: string;
  occurrences: number;
  durationMinutes: number;
  codeProgressionDelta: number;
  isChronicLoop: boolean; // > 10 minutes without semantic progression
}

export interface FatigueCommitObservation {
  commitSha: string;
  sessionFatigueIndex: number; // 0..100
  bugOrRevertIntroduced: boolean;
}

export interface FlowStateAnalysisResult {
  processingTimeMs: number;
  flowScore: number; // 0..100
  cognitiveFatigueIndex: number; // 0..100
  stateLabel: 'DEEP_FLOW' | 'STEADY_FOCUS' | 'RISING_FATIGUE' | 'ERROR_THRASHING';
  metrics: {
    sampleCount: number;
    meanInterKeyIntervalMs: number;
    ikiCoefficientOfVariation: number;
    pauseShannonEntropy: number;
    backspaceRatio: number;
    activeFlowMinutes: number;
  };
  compileLoops: CompileThrashingLoop[];
  wellnessNudge: {
    shouldDisplay: boolean;
    tone: 'GENTLE_BREATHER' | 'LOOP_RECOVERY' | 'NONE';
    message: string | null;
    actionableTip: string | null;
  };
}

const MS_PER_MINUTE = 60_000;

@Injectable()
export class FlowStateService {
  private readonly inMemorySnapshots: Array<{
    userHash: string;
    repositoryId?: string;
    windowMinutes: number;
    rollingFlowScore: number;
    rollingFatigueIndex: number;
    backspaceRatio: number;
    compileLoopCount: number;
    bugInsertionCorrelation?: number;
    nudgeTriggered: boolean;
    createdAt: Date;
  }> = [];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  hashUserId(userId: string): string {
    return crypto.createHash('sha256').update(`codepulse-flow:${userId}`).digest('hex').slice(0, 32);
  }

  /**
   * Computes Shannon entropy H = -sum(p_i * log2(p_i)) across 5 log-spaced
   * inter-keystroke pause buckets to measure typing rhythm regularity vs erratic stalling.
   */
  computePauseShannonEntropy(intervalsMs: number[]): number {
    if (intervalsMs.length === 0) return 0;
    const buckets = [0, 0, 0, 0, 0]; // <120ms, 120-250ms, 250-600ms, 600-2000ms, >2000ms

    for (const dt of intervalsMs) {
      if (dt < 120) buckets[0] += 1;
      else if (dt < 250) buckets[1] += 1;
      else if (dt < 600) buckets[2] += 1;
      else if (dt < 2000) buckets[3] += 1;
      else buckets[4] += 1;
    }

    const total = intervalsMs.length;
    let entropy = 0;
    for (const count of buckets) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }
    return Number(entropy.toFixed(4));
  }

  /**
   * Detects unproductive error loops where the developer hits identical compile/syntax
   * errors repeatedly for > 10 minutes without meaningful AST code progression.
   */
  detectCompileErrorLoops(compileEvents: CompileErrorEvent[]): CompileThrashingLoop[] {
    if (!Array.isArray(compileEvents) || compileEvents.length < 2) return [];

    const grouped = new Map<string, CompileErrorEvent[]>();
    for (const ev of compileEvents) {
      const sig = `${ev.filePath}::${ev.errorCode}:${ev.normalizedMessage.trim().toLowerCase()}`;
      const list = grouped.get(sig) ?? [];
      list.push(ev);
      grouped.set(sig, list);
    }

    const loops: CompileThrashingLoop[] = [];
    for (const [sig, events] of grouped.entries()) {
      if (events.length < 3) continue;
      const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
      const durationMinutes = Number(
        ((sorted[sorted.length - 1].timestampMs - sorted[0].timestampMs) / MS_PER_MINUTE).toFixed(2),
      );
      const astProgression = Math.abs(
        sorted[sorted.length - 1].astNodeCount - sorted[0].astNodeCount,
      );

      // Chronic loop: repeated >= 3 times spanning > 10 minutes with minimal AST progression (<= 3 nodes)
      const isChronicLoop = durationMinutes > 10 && astProgression <= 3;
      if (isChronicLoop || durationMinutes >= 8) {
        loops.push({
          errorSignature: sig,
          filePath: sorted[0].filePath,
          occurrences: sorted.length,
          durationMinutes,
          codeProgressionDelta: astProgression,
          isChronicLoop,
        });
      }
    }

    return loops.sort((a, b) => b.durationMinutes - a.durationMinutes);
  }

  /**
   * Calculates Flow Score (0-100) and Cognitive Fatigue Index (0-100) in < 10ms
   * from keystroke rhythm regularity, Shannon pause entropy, backspace frequency,
   * session duration, and compile error thrashing loops.
   */
  analyzeTelemetryBatch(params: {
    keystrokes: KeystrokeTimingEvent[];
    compileErrors?: CompileErrorEvent[];
    continuousSessionMinutes?: number;
  }): FlowStateAnalysisResult {
    const t0 = performance.now();
    const events = [...(params.keystrokes ?? [])].sort((a, b) => a.timestampMs - b.timestampMs);
    const compileLoops = this.detectCompileErrorLoops(params.compileErrors ?? []);
    const chronicLoopCount = compileLoops.filter((l) => l.isChronicLoop).length;

    let backspaceCount = 0;
    const intervals: number[] = [];

    for (let i = 0; i < events.length; i++) {
      if (events[i].isBackspace) backspaceCount += 1;
      if (i > 0) {
        const dt = Math.max(1, events[i].timestampMs - events[i - 1].timestampMs);
        // Cap idle pauses at 10s so bathroom breaks don't blow up variance
        intervals.push(Math.min(10_000, dt));
      }
    }

    const sampleCount = events.length;
    const backspaceRatio =
      sampleCount > 0 ? Number((backspaceCount / sampleCount).toFixed(4)) : 0;

    const meanIki =
      intervals.length > 0
        ? intervals.reduce((acc, v) => acc + v, 0) / intervals.length
        : 220;
    const varianceIki =
      intervals.length > 0
        ? intervals.reduce((acc, v) => acc + (v - meanIki) ** 2, 0) / intervals.length
        : 0;
    const stdDevIki = Math.sqrt(varianceIki);
    const cvIki = meanIki > 0 ? stdDevIki / meanIki : 0;
    const entropy = this.computePauseShannonEntropy(intervals);

    const inferredMinutes =
      events.length >= 2
        ? (events[events.length - 1].timestampMs - events[0].timestampMs) / MS_PER_MINUTE
        : 0;
    const activeFlowMinutes = Number(
      (params.continuousSessionMinutes ?? inferredMinutes).toFixed(1),
    );

    // Flow Score (0..100): boosted by steady typing cadence (low CV, moderate entropy) and low backspace churn
    const rhythmScore = Math.max(0, 100 - cvIki * 38);
    const backspacePenalty = Math.min(45, backspaceRatio * 140);
    const loopPenalty = chronicLoopCount * 28;
    const flowScore = Math.round(
      Math.max(0, Math.min(100, rhythmScore * 0.72 + (2.32 - Math.min(2.32, entropy)) * 12 - backspacePenalty - loopPenalty)),
    );

    // Cognitive Fatigue Index (0..100): rises with elevated backspace rate, erratic pauses, prolonged session, and compile thrashing
    const fatigueRaw =
      backspaceRatio * 125 +
      Math.min(30, cvIki * 22) +
      Math.max(0, (activeFlowMinutes - 60) * 0.45) +
      chronicLoopCount * 25;
    const cognitiveFatigueIndex = Math.round(Math.max(0, Math.min(100, fatigueRaw)));

    let stateLabel: FlowStateAnalysisResult['stateLabel'] = 'STEADY_FOCUS';
    if (chronicLoopCount > 0) stateLabel = 'ERROR_THRASHING';
    else if (cognitiveFatigueIndex >= 65) stateLabel = 'RISING_FATIGUE';
    else if (flowScore >= 75) stateLabel = 'DEEP_FLOW';

    // Gentle non-intrusive wellness nudges
    let wellnessNudge: FlowStateAnalysisResult['wellnessNudge'] = {
      shouldDisplay: false,
      tone: 'NONE',
      message: null,
      actionableTip: null,
    };

    if (chronicLoopCount > 0) {
      wellnessNudge = {
        shouldDisplay: true,
        tone: 'LOOP_RECOVERY',
        message: `You have hit the same compiler error for over ${Math.round(compileLoops[0].durationMinutes)} minutes without AST progress.`,
        actionableTip:
          'Step back from the editor for 3 minutes, isolate a minimal reproduction test case, or rubber-duck the type signature.',
      };
    } else if (activeFlowMinutes >= 90 || cognitiveFatigueIndex >= 68) {
      wellnessNudge = {
        shouldDisplay: true,
        tone: 'GENTLE_BREATHER',
        message: 'You have been in intense flow for 90 minutes. Take a 5-minute breather!',
        actionableTip:
          'Rest your eyes (20-20-20 rule), hydrate, and stretch before starting your next commit block.',
      };
    }

    const processingTimeMs = Number((performance.now() - t0).toFixed(3));

    return {
      processingTimeMs,
      flowScore,
      cognitiveFatigueIndex,
      stateLabel,
      metrics: {
        sampleCount,
        meanInterKeyIntervalMs: Number(meanIki.toFixed(2)),
        ikiCoefficientOfVariation: Number(cvIki.toFixed(4)),
        pauseShannonEntropy: entropy,
        backspaceRatio,
        activeFlowMinutes,
      },
      compileLoops,
      wellnessNudge,
    };
  }

  /**
   * Correlates session Cognitive Fatigue Index with bug/revert insertion rates
   * across historical repository commits via Pearson correlation coefficient r.
   */
  correlateFatigueWithBugRate(observations: FatigueCommitObservation[]): {
    sampleCommits: number;
    pearsonCorrelationR: number;
    highFatigueBugRatePercent: number;
    lowFatigueBugRatePercent: number;
    insight: string;
  } {
    if (observations.length < 2) {
      return {
        sampleCommits: observations.length,
        pearsonCorrelationR: 0,
        highFatigueBugRatePercent: 0,
        lowFatigueBugRatePercent: 0,
        insight: 'Insufficient commit history to correlate cognitive fatigue with bug insertion.',
      };
    }

    const xs = observations.map((o) => o.sessionFatigueIndex);
    const ys = observations.map((o) => (o.bugOrRevertIntroduced ? 1 : 0));

    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const denom = Math.sqrt(denX * denY);
    const r = denom > 0 ? Number((num / denom).toFixed(4)) : 0;

    const highFatigue = observations.filter((o) => o.sessionFatigueIndex >= 65);
    const lowFatigue = observations.filter((o) => o.sessionFatigueIndex < 65);

    const highRate =
      highFatigue.length > 0
        ? Number(
            ((highFatigue.filter((o) => o.bugOrRevertIntroduced).length / highFatigue.length) *
              100).toFixed(1),
          )
        : 0;
    const lowRate =
      lowFatigue.length > 0
        ? Number(
            ((lowFatigue.filter((o) => o.bugOrRevertIntroduced).length / lowFatigue.length) *
              100).toFixed(1),
          )
        : 0;

    return {
      sampleCommits: observations.length,
      pearsonCorrelationR: r,
      highFatigueBugRatePercent: highRate,
      lowFatigueBugRatePercent: lowRate,
      insight: `Commits authored at >=65 Cognitive Fatigue Index exhibit a ${highRate}% bug/revert rate vs ${lowRate}% during rested flow (r=${r}).`,
    };
  }

  /**
   * Persists privacy-preserving rolling flow & fatigue aggregates (hashed user ID,
   * zero raw keystrokes) into Prisma DeveloperFatigueSnapshot.
   */
  async persistRollingSnapshot(params: {
    userId: string;
    repositoryId?: string;
    windowMinutes?: number;
    analysis: FlowStateAnalysisResult;
    bugInsertionCorrelation?: number;
  }) {
    const userHash = this.hashUserId(params.userId);
    const payload = {
      userHash,
      repositoryId: params.repositoryId ?? null,
      windowMinutes: params.windowMinutes ?? 30,
      rollingFlowScore: params.analysis.flowScore,
      rollingFatigueIndex: params.analysis.cognitiveFatigueIndex,
      backspaceRatio: params.analysis.metrics.backspaceRatio,
      compileLoopCount: params.analysis.compileLoops.filter((l) => l.isChronicLoop).length,
      bugInsertionCorrelation: params.bugInsertionCorrelation ?? null,
      nudgeTriggered: params.analysis.wellnessNudge.shouldDisplay,
    };

    if (this.prisma && (this.prisma as any).developerFatigueSnapshot?.create) {
      return (this.prisma as any).developerFatigueSnapshot.create({ data: payload });
    }

    const fallbackRecord = {
      id: `snap-${this.inMemorySnapshots.length + 1}`,
      ...payload,
      repositoryId: params.repositoryId,
      bugInsertionCorrelation: params.bugInsertionCorrelation,
      createdAt: new Date(),
    };
    this.inMemorySnapshots.push(fallbackRecord);
    return fallbackRecord;
  }
}
