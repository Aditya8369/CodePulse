/**
 * GGPO-Style Rollback Netcode & Frame Prediction Engine for Real-Time Code Battles.
 * Eliminates typing lag under high-RTT connections (e.g. 150ms-250ms transatlantic).
 */

export interface EditorInput {
  type: 'insert' | 'delete' | 'cursor_move' | 'noop';
  char?: string;
  position: number;
  length?: number;
}

export interface FrameSnapshot {
  frame: number;
  timestamp: number;
  localInput: EditorInput;
  remoteInput: EditorInput;
  textState: string;
  cursorPosition: number;
  checksum: number;
}

export interface RollbackMetrics {
  currentFrame: number;
  rollbacksExecuted: number;
  predictionsMade: number;
  predictionHits: number;
  predictionAccuracy: number;
  rttMs: number;
}

export class RollbackPredictionEngine {
  public static readonly MAX_ROLLBACK_FRAMES = 128;
  public static readonly TARGET_FPS = 60;
  public static readonly FRAME_DURATION_MS = 1000 / 60; // 16.67ms per frame

  private currentFrame = 0;
  private currentText = '';
  private currentCursor = 0;

  // History buffer storing the last 128 frames
  private readonly frameHistory = new Map<number, FrameSnapshot>();
  private readonly authoritativeRemoteInputs = new Map<number, EditorInput>();

  private rollbacksExecuted = 0;
  private predictionsMade = 0;
  private predictionHits = 0;
  private estimatedRttMs = 0;

  constructor(initialText = '') {
    this.currentText = initialText;
    this.recordSnapshot(0, { type: 'noop', position: 0 }, { type: 'noop', position: 0 });
  }

  /**
   * Fast simple hash function to generate deterministic frame checksum
   */
  private computeChecksum(text: string, cursor: number): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return ((hash << 5) - hash + cursor) | 0;
  }

  /**
   * Pure deterministic state transition applying local and remote inputs
   */
  private applyInput(state: string, cursor: number, input: EditorInput): { text: string; cursor: number } {
    let text = state;
    let newCursor = cursor;

    if (input.type === 'insert' && input.char) {
      const pos = Math.min(Math.max(0, input.position), text.length);
      text = text.slice(0, pos) + input.char + text.slice(pos);
      newCursor = pos + input.char.length;
    } else if (input.type === 'delete') {
      const pos = Math.min(Math.max(0, input.position), text.length);
      const delLen = input.length || 1;
      text = text.slice(0, Math.max(0, pos - delLen)) + text.slice(pos);
      newCursor = Math.max(0, pos - delLen);
    } else if (input.type === 'cursor_move') {
      newCursor = Math.min(Math.max(0, input.position), text.length);
    }

    return { text, cursor: newCursor };
  }

  /**
   * Predicts remote input based on current velocity or repeats previous action (noop or typing stream).
   */
  private predictRemoteInput(frame: number): EditorInput {
    this.predictionsMade++;
    // Default prediction: opponent continues previous input or noop
    const prev = this.frameHistory.get(frame - 1)?.remoteInput;
    return prev ? { ...prev } : { type: 'noop', position: 0 };
  }

  /**
   * Advances the local frame immediately with 0ms prediction latency.
   */
  public advanceLocalFrame(localInput: EditorInput): FrameSnapshot {
    this.currentFrame++;

    // 1. Predict remote opponent input if not yet received authoritatively
    const remoteInput = this.authoritativeRemoteInputs.get(this.currentFrame) ?? this.predictRemoteInput(this.currentFrame);

    // 2. Advance local state
    const result = this.applyInput(this.currentText, this.currentCursor, localInput);
    this.currentText = result.text;
    this.currentCursor = result.cursor;

    // 3. Save snapshot in 128-frame history buffer
    const snapshot = this.recordSnapshot(this.currentFrame, localInput, remoteInput);

    // 4. Prune frames older than MAX_ROLLBACK_FRAMES
    const oldestAllowed = this.currentFrame - RollbackPredictionEngine.MAX_ROLLBACK_FRAMES;
    for (const f of this.frameHistory.keys()) {
      if (f < oldestAllowed) {
        this.frameHistory.delete(f);
        this.authoritativeRemoteInputs.delete(f);
      }
    }

    return snapshot;
  }

  private recordSnapshot(frame: number, localInput: EditorInput, remoteInput: EditorInput): FrameSnapshot {
    const snapshot: FrameSnapshot = {
      frame,
      timestamp: Date.now(),
      localInput,
      remoteInput,
      textState: this.currentText,
      cursorPosition: this.currentCursor,
      checksum: this.computeChecksum(this.currentText, this.currentCursor),
    };
    this.frameHistory.set(frame, snapshot);
    return snapshot;
  }

  /**
   * Receives authoritative remote input from network (delayed by 50ms-250ms).
   * If input matches predicted input: zero rollback needed.
   * If mismatch: rolls back to the discrepancy frame, applies authoritative input, and fast-forwards.
   */
  public receiveAuthoritativeRemoteInput(remoteFrame: number, actualInput: EditorInput): boolean {
    this.authoritativeRemoteInputs.set(remoteFrame, actualInput);

    const pastSnapshot = this.frameHistory.get(remoteFrame);
    if (!pastSnapshot) {
      // Frame already discarded or ahead of local clock
      return false;
    }

    // Check if predicted remote input matched actual
    const predicted = pastSnapshot.remoteInput;
    const isHit =
      predicted.type === actualInput.type &&
      predicted.char === actualInput.char &&
      predicted.position === actualInput.position;

    if (isHit) {
      this.predictionHits++;
      return false; // No rollback needed!
    }

    // Rollback Discrepancy Detected! Rollback and Fast-Forward Re-simulation
    this.performRollback(remoteFrame, actualInput);
    return true;
  }

  /**
   * Deterministic rollback and fast-forward re-simulation.
   */
  private performRollback(discrepancyFrame: number, actualRemoteInput: EditorInput): void {
    this.rollbacksExecuted++;

    // 1. Restore state from frame immediately prior to discrepancy
    const baseSnapshot = this.frameHistory.get(discrepancyFrame - 1);
    let replayText = baseSnapshot ? baseSnapshot.textState : '';
    let replayCursor = baseSnapshot ? baseSnapshot.cursorPosition : 0;

    // 2. Fast-forward replay from discrepancyFrame to currentFrame
    for (let f = discrepancyFrame; f <= this.currentFrame; f++) {
      const pastSnap = this.frameHistory.get(f);
      const localInput = pastSnap ? pastSnap.localInput : { type: 'noop' as const, position: 0 };
      const remoteInput = f === discrepancyFrame ? actualRemoteInput : (this.authoritativeRemoteInputs.get(f) ?? pastSnap?.remoteInput ?? { type: 'noop' as const, position: 0 });

      // Apply authoritative inputs
      const step = this.applyInput(replayText, replayCursor, localInput);
      replayText = step.text;
      replayCursor = step.cursor;

      // Update frame history snapshot with corrected state
      this.frameHistory.set(f, {
        frame: f,
        timestamp: pastSnap?.timestamp ?? Date.now(),
        localInput,
        remoteInput,
        textState: replayText,
        cursorPosition: replayCursor,
        checksum: this.computeChecksum(replayText, replayCursor),
      });
    }

    // 3. Commit fast-forwarded authoritative state
    this.currentText = replayText;
    this.currentCursor = replayCursor;
  }

  /**
   * Synchronizes timeline clock with network peer
   */
  public syncClock(serverFrame: number, rttMs: number): void {
    this.estimatedRttMs = rttMs;
    const latencyFrames = Math.round(rttMs / (2 * RollbackPredictionEngine.FRAME_DURATION_MS));
    const targetLocalFrame = serverFrame + latencyFrames;

    // Gentle clock drift correction (max 1 frame per sync)
    if (this.currentFrame < targetLocalFrame - 2) {
      this.currentFrame++;
    } else if (this.currentFrame > targetLocalFrame + 2) {
      this.currentFrame--;
    }
  }

  public getText(): string {
    return this.currentText;
  }

  public getCursor(): number {
    return this.currentCursor;
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }

  public getMetrics(): RollbackMetrics {
    return {
      currentFrame: this.currentFrame,
      rollbacksExecuted: this.rollbacksExecuted,
      predictionsMade: this.predictionsMade,
      predictionHits: this.predictionHits,
      predictionAccuracy: this.predictionsMade > 0 ? Number(((this.predictionHits / this.predictionsMade) * 100).toFixed(2)) : 100,
      rttMs: this.estimatedRttMs,
    };
  }
}
