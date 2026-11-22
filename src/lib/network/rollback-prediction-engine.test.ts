import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackPredictionEngine, EditorInput } from './rollback-prediction-engine';

describe('RollbackPredictionEngine (GGPO Netcode for High-RTT Esports)', () => {
  let engine: RollbackPredictionEngine;

  beforeEach(() => {
    engine = new RollbackPredictionEngine('const x = 0;');
  });

  it('provides instantaneous 0ms local typing feedback with frame progression', () => {
    expect(engine.getCurrentFrame()).toBe(0);
    expect(engine.getText()).toBe('const x = 0;');

    const input: EditorInput = { type: 'insert', char: 'let y = 1; ', position: 0 };
    const snapshot = engine.advanceLocalFrame(input);

    expect(engine.getCurrentFrame()).toBe(1);
    expect(snapshot.textState).toBe('let y = 1; const x = 0;');
    expect(engine.getText()).toBe('let y = 1; const x = 0;');
    expect(engine.getCursor()).toBe(11);
  });

  it('performs deterministic rollback and fast-forward when late remote input mismatches prediction', () => {
    // Local advances frames 1, 2, 3, 4 locally
    engine.advanceLocalFrame({ type: 'insert', char: 'a', position: 12 }); // frame 1
    engine.advanceLocalFrame({ type: 'insert', char: 'b', position: 13 }); // frame 2
    engine.advanceLocalFrame({ type: 'insert', char: 'c', position: 14 }); // frame 3
    engine.advanceLocalFrame({ type: 'insert', char: 'd', position: 15 }); // frame 4

    expect(engine.getCurrentFrame()).toBe(4);
    const preRollbackText = engine.getText();

    // Late authoritative remote input arrives for frame 2 (100ms delayed)
    const delayedInput: EditorInput = { type: 'insert', char: '// OP ', position: 0 };
    const rolledBack = engine.receiveAuthoritativeRemoteInput(2, delayedInput);

    expect(rolledBack).toBe(true); // Discrepancy triggered rollback!
    const metrics = engine.getMetrics();
    expect(metrics.rollbacksExecuted).toBe(1);
    expect(engine.getCurrentFrame()).toBe(4); // Seamlessly fast-forwarded back to frame 4!
  });

  it('evicts history frames older than 128 frames', () => {
    for (let f = 1; f <= 150; f++) {
      engine.advanceLocalFrame({ type: 'noop', position: 0 });
    }

    expect(engine.getCurrentFrame()).toBe(150);
    // Frame 1 should now be evicted
    const lateFrame1 = engine.receiveAuthoritativeRemoteInput(1, { type: 'insert', char: 'x', position: 0 });
    expect(lateFrame1).toBe(false); // Discarded as beyond rollback window
  });

  it('syncs timeline clock smoothly with remote peer latency', () => {
    engine.syncClock(10, 160); // 160ms RTT = ~5 frames latency
    const metrics = engine.getMetrics();
    expect(metrics.rttMs).toBe(160);
  });
});
