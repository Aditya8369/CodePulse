import { FlowStateService } from './flow-state.service';

describe('FlowStateService (Sub-10ms Flow/Fatigue Telemetry, Thrashing Loops & Bug Correlation)', () => {
  let service: FlowStateService;

  beforeEach(() => {
    service = new FlowStateService();
  });

  it('computes Flow Score, Cognitive Fatigue Index, Shannon entropy, and 90-min wellness nudge in < 10ms', () => {
    // 1. Steady rhythmic flow typing (160ms IKI, 2% backspaces, 92 minutes session)
    const steadyKeystrokes = Array.from({ length: 400 }, (_, i) => ({
      timestampMs: 1_000_000 + i * 160 + (i % 3) * 8,
      isBackspace: i % 50 === 0,
    }));

    const flowResult = service.analyzeTelemetryBatch({
      keystrokes: steadyKeystrokes,
      continuousSessionMinutes: 92,
    });

    expect(flowResult.processingTimeMs).toBeLessThan(10);
    expect(flowResult.flowScore).toBeGreaterThanOrEqual(75);
    expect(flowResult.wellnessNudge.shouldDisplay).toBe(true);
    expect(flowResult.wellnessNudge.message).toBe(
      'You have been in intense flow for 90 minutes. Take a 5-minute breather!',
    );
  });

  it('detects chronic >10-minute compile error thrashing loops and correlates fatigue with bug insertion rates', async () => {
    const baseMs = 5_000_000;
    const thrashingResult = service.analyzeTelemetryBatch({
      keystrokes: Array.from({ length: 120 }, (_, i) => ({
        timestampMs: baseMs + i * 500,
        isBackspace: i % 3 === 0, // 33% backspace churn
      })),
      compileErrors: [
        {
          timestampMs: baseMs,
          errorCode: 'TS2322',
          normalizedMessage: "Type 'string' is not assignable to type 'number'",
          filePath: 'src/engine/parser.ts',
          astNodeCount: 44,
        },
        {
          timestampMs: baseMs + 6 * 60_000,
          errorCode: 'TS2322',
          normalizedMessage: "Type 'string' is not assignable to type 'number'",
          filePath: 'src/engine/parser.ts',
          astNodeCount: 44,
        },
        {
          timestampMs: baseMs + 12 * 60_000,
          errorCode: 'TS2322',
          normalizedMessage: "Type 'string' is not assignable to type 'number'",
          filePath: 'src/engine/parser.ts',
          astNodeCount: 45,
        },
      ],
    });

    expect(thrashingResult.stateLabel).toBe('ERROR_THRASHING');
    expect(thrashingResult.compileLoops).toHaveLength(1);
    expect(thrashingResult.compileLoops[0].isChronicLoop).toBe(true);
    expect(thrashingResult.compileLoops[0].durationMinutes).toBe(12);

    const correlation = service.correlateFatigueWithBugRate([
      { commitSha: 'c1', sessionFatigueIndex: 20, bugOrRevertIntroduced: false },
      { commitSha: 'c2', sessionFatigueIndex: 25, bugOrRevertIntroduced: false },
      { commitSha: 'c3', sessionFatigueIndex: 78, bugOrRevertIntroduced: true },
      { commitSha: 'c4', sessionFatigueIndex: 85, bugOrRevertIntroduced: true },
    ]);

    expect(correlation.pearsonCorrelationR).toBeGreaterThan(0.9);
    expect(correlation.highFatigueBugRatePercent).toBe(100);

    const snap = await service.persistRollingSnapshot({
      userId: 'sonia-dev',
      repositoryId: 'codepulse',
      analysis: thrashingResult,
      bugInsertionCorrelation: correlation.pearsonCorrelationR,
    });
    expect(snap.userHash).not.toContain('sonia-dev');
    expect(snap.compileLoopCount).toBe(1);
  });
});
