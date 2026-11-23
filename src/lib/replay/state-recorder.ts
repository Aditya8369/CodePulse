/**
 * CodePulse Event-Sourced Match State Recorder & Time-Travel Engine
 * Implements deterministic action streaming, 5-second snapshot ring buffer,
 * and pure state reconstruction allowing instant sub-16ms seeks across 15+ minute timelines.
 */

export type ReplayActionType =
  | 'MATCH_START'
  | 'KEYSTROKE_INSERT'
  | 'KEYSTROKE_DELETE'
  | 'CODE_REPLACE'
  | 'TEST_EXECUTION'
  | 'HP_DELTA'
  | 'SABOTAGE_TRIGGER'
  | 'SCORE_UPDATE'
  | 'MATCH_END';

export interface ReplayAction {
  id: string;
  seq: number;
  timestamp: number; // millisecond timestamp relative to match start
  type: ReplayActionType;
  payload: {
    playerId: string;
    text?: string;
    index?: number;
    length?: number;
    code?: string;
    testsPassed?: number;
    totalTests?: number;
    hpDelta?: number;
    sabotageType?: string;
    score?: number;
  };
}

export interface PlayerMatchState {
  code: string;
  cursorPosition: number;
  health: number;
  testsPassed: number;
  totalTests: number;
  score: number;
  activeSabotages: string[];
}

export interface ReplaySnapshot {
  seq: number;
  timestamp: number;
  players: Record<string, PlayerMatchState>;
}

export interface ReplayTimelineMarker {
  seq: number;
  timestamp: number;
  label: string;
  type: 'TEST_PASS' | 'TEST_FAIL' | 'SABOTAGE' | 'CRITICAL_HP';
}

export class StateRecorder {
  private actions: ReplayAction[] = [];
  private snapshots: ReplaySnapshot[] = [];
  private readonly snapshotIntervalMs = 5000; // Snapshot every 5 seconds
  private lastSnapshotTime = 0;
  private currentSeq = 0;

  constructor(initialPlayers: string[] = ['player-1', 'player-2']) {
    const initialPlayersState: Record<string, PlayerMatchState> = {};
    for (const p of initialPlayers) {
      initialPlayersState[p] = {
        code: '',
        cursorPosition: 0,
        health: 100,
        testsPassed: 0,
        totalTests: 0,
        score: 0,
        activeSabotages: [],
      };
    }

    // Initial origin snapshot at t = 0
    this.snapshots.push({
      seq: 0,
      timestamp: 0,
      players: initialPlayersState,
    });
  }

  /**
   * Records a new discrete action into the deterministic event store
   */
  recordAction(
    type: ReplayActionType,
    payload: ReplayAction['payload'],
    timestamp: number,
  ): ReplayAction {
    this.currentSeq++;
    const action: ReplayAction = {
      id: `act-${this.currentSeq}`,
      seq: this.currentSeq,
      timestamp,
      type,
      payload,
    };

    this.actions.push(action);

    // Periodically capture immutable state snapshots every 5 seconds
    if (timestamp - this.lastSnapshotTime >= this.snapshotIntervalMs) {
      const computedState = this.reduceState(action.seq);
      this.snapshots.push({
        seq: action.seq,
        timestamp,
        players: computedState,
      });
      this.lastSnapshotTime = timestamp;
    }

    return action;
  }

  /**
   * Fast state reconciliation: seeks to closest preceding snapshot,
   * then folds forward remaining delta actions in < 16ms.
   */
  seekToTimestamp(targetTimestampMs: number): {
    timestamp: number;
    seq: number;
    state: Record<string, PlayerMatchState>;
    seekTimeMs: number;
  } {
    const startTime = performance.now();

    // 1. Binary search closest preceding snapshot
    let low = 0;
    let high = this.snapshots.length - 1;
    let snapshotIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.snapshots[mid].timestamp <= targetTimestampMs) {
        snapshotIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const baseSnapshot = this.snapshots[snapshotIndex];
    const workingState: Record<string, PlayerMatchState> = JSON.parse(
      JSON.stringify(baseSnapshot.players),
    );

    // 2. Fold delta actions from baseSnapshot.seq up to targetTimestampMs
    let finalSeq = baseSnapshot.seq;
    for (let i = baseSnapshot.seq; i < this.actions.length; i++) {
      const act = this.actions[i];
      if (act.timestamp > targetTimestampMs) break;
      this.applyActionToState(workingState, act);
      finalSeq = act.seq;
    }

    const seekTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      timestamp: targetTimestampMs,
      seq: finalSeq,
      state: workingState,
      seekTimeMs,
    };
  }

  /**
   * Pure state reducer from seq 0 or snapshot
   */
  private reduceState(targetSeq: number): Record<string, PlayerMatchState> {
    const workingState: Record<string, PlayerMatchState> = JSON.parse(
      JSON.stringify(this.snapshots[0].players),
    );

    for (let i = 0; i < targetSeq && i < this.actions.length; i++) {
      this.applyActionToState(workingState, this.actions[i]);
    }

    return workingState;
  }

  /**
   * Applies a single delta micro-action onto working player state
   */
  private applyActionToState(
    state: Record<string, PlayerMatchState>,
    action: ReplayAction,
  ): void {
    const { playerId } = action.payload;
    if (!state[playerId]) {
      state[playerId] = {
        code: '',
        cursorPosition: 0,
        health: 100,
        testsPassed: 0,
        totalTests: 0,
        score: 0,
        activeSabotages: [],
      };
    }

    const p = state[playerId];

    switch (action.type) {
      case 'KEYSTROKE_INSERT':
        if (action.payload.text !== undefined) {
          const idx = action.payload.index ?? p.code.length;
          p.code = p.code.slice(0, idx) + action.payload.text + p.code.slice(idx);
          p.cursorPosition = idx + action.payload.text.length;
        }
        break;

      case 'KEYSTROKE_DELETE':
        if (action.payload.length !== undefined) {
          const idx = action.payload.index ?? Math.max(0, p.code.length - action.payload.length);
          p.code = p.code.slice(0, idx) + p.code.slice(idx + action.payload.length);
          p.cursorPosition = idx;
        }
        break;

      case 'CODE_REPLACE':
        if (action.payload.code !== undefined) {
          p.code = action.payload.code;
          p.cursorPosition = p.code.length;
        }
        break;

      case 'TEST_EXECUTION':
        p.testsPassed = action.payload.testsPassed ?? p.testsPassed;
        p.totalTests = action.payload.totalTests ?? p.totalTests;
        break;

      case 'HP_DELTA':
        p.health = Math.max(0, Math.min(100, p.health + (action.payload.hpDelta ?? 0)));
        break;

      case 'SABOTAGE_TRIGGER':
        if (action.payload.sabotageType) {
          p.activeSabotages.push(action.payload.sabotageType);
        }
        break;

      case 'SCORE_UPDATE':
        p.score = action.payload.score ?? p.score;
        break;
    }
  }

  /**
   * Extracts visual timeline markers (test passes, sabotages, health warnings)
   */
  getTimelineMarkers(): ReplayTimelineMarker[] {
    const markers: ReplayTimelineMarker[] = [];

    for (const act of this.actions) {
      if (act.type === 'TEST_EXECUTION') {
        const passed = (act.payload.testsPassed ?? 0) === (act.payload.totalTests ?? 0);
        markers.push({
          seq: act.seq,
          timestamp: act.timestamp,
          label: `${act.payload.playerId}: ${act.payload.testsPassed}/${act.payload.totalTests} tests`,
          type: passed ? 'TEST_PASS' : 'TEST_FAIL',
        });
      } else if (act.type === 'SABOTAGE_TRIGGER') {
        markers.push({
          seq: act.seq,
          timestamp: act.timestamp,
          label: `${act.payload.playerId} Sabotage: ${act.payload.sabotageType}`,
          type: 'SABOTAGE',
        });
      } else if (act.type === 'HP_DELTA' && (act.payload.hpDelta ?? 0) < -25) {
        markers.push({
          seq: act.seq,
          timestamp: act.timestamp,
          label: `${act.payload.playerId} Critical Hit (${act.payload.hpDelta} HP)`,
          type: 'CRITICAL_HP',
        });
      }
    }

    return markers;
  }

  getActions(): ReplayAction[] {
    return this.actions;
  }

  getSnapshots(): ReplaySnapshot[] {
    return this.snapshots;
  }

  getTotalDurationMs(): number {
    return this.actions.length > 0 ? this.actions[this.actions.length - 1].timestamp : 0;
  }

  exportSessionJson(): string {
    return JSON.stringify({
      version: 1,
      totalActions: this.actions.length,
      durationMs: this.getTotalDurationMs(),
      actions: this.actions,
      snapshots: this.snapshots,
    });
  }

  importSessionJson(jsonStr: string): void {
    const parsed = JSON.parse(jsonStr);
    this.actions = parsed.actions || [];
    this.snapshots = parsed.snapshots || [];
    this.currentSeq = this.actions.length;
    this.lastSnapshotTime =
      this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].timestamp : 0;
  }
}
