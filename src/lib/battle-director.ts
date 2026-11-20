export type PlayerId = "p1" | "p2";

export type DirectorMode = "ai" | "caster_override";

export type FocusState = PlayerId | "balanced";

export interface BattleTelemetryEvent {
  battleId: string;
  userId: string;
  player: PlayerId;
  eventType:
    | "keystroke"
    | "test_case_eval"
    | "syntax_error"
    | "code_submit"
    | "test_pass"
    | "test_fail";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PlayerTelemetrySnapshot {
  player: PlayerId;
  apm: number;
  burstApm: number;
  lastKeystrokeAt: number | null;
  testProgress: { passed: number; total: number };
  lastEvent: BattleTelemetryEvent | null;
  failingTests: number;
  syntaxErrors: number;
}

interface DirectorConfig {
  focusCooldownMs: number;
  excitementThreshold: number;
  burstWindowMs: number;
}

const DEFAULT_CONFIG: DirectorConfig = {
  focusCooldownMs: 500,
  excitementThreshold: 40,
  burstWindowMs: 10000,
};

export class StudioDirector {
  private config: DirectorConfig;
  private focus: FocusState = "balanced";
  private mode: DirectorMode = "ai";
  private casterLock: PlayerId | null = null;
  private lastFocusChangeAt = 0;
  private telemetry: Map<PlayerId, PlayerTelemetrySnapshot> = new Map();
  private eventHistory: BattleTelemetryEvent[] = [];

  constructor(config: Partial<DirectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.telemetry.set("p1", this.emptySnapshot("p1"));
    this.telemetry.set("p2", this.emptySnapshot("p2"));
  }

  private emptySnapshot(player: PlayerId): PlayerTelemetrySnapshot {
    return {
      player,
      apm: 0,
      burstApm: 0,
      lastKeystrokeAt: null,
      testProgress: { passed: 0, total: 0 },
      lastEvent: null,
      failingTests: 0,
      syntaxErrors: 0,
    };
  }

  getFocus(): FocusState {
    return this.focus;
  }

  getMode(): DirectorMode {
    return this.mode;
  }

  getCasterLock(): PlayerId | null {
    return this.casterLock;
  }

  getTelemetry(player: PlayerId): PlayerTelemetrySnapshot {
    return this.telemetry.get(player) ?? this.emptySnapshot(player);
  }

  getEventHistory(): BattleTelemetryEvent[] {
    return [...this.eventHistory];
  }

  ingest(event: BattleTelemetryEvent): { switched: boolean; focus: FocusState; reason: string } {
    this.eventHistory.push(event);
    const snap = this.telemetry.get(event.player) ?? this.emptySnapshot(event.player);
    snap.lastEvent = event;
    snap.lastKeystrokeAt =
      event.eventType === "keystroke" ? event.timestamp : snap.lastKeystrokeAt;

    switch (event.eventType) {
      case "keystroke": {
        const delta = Number(event.data.deltaLength ?? 0);
        snap.apm = Math.round(((snap.apm * 9 + delta) / 10) * 6);
        snap.burstApm = Math.max(snap.burstApm, delta);
        break;
      }
      case "test_case_eval": {
        const passed = Number(event.data.passedCount ?? 0);
        const total = Number(event.data.totalCount ?? 0);
        snap.testProgress = { passed, total };
        snap.failingTests = Math.max(0, total - passed);
        break;
      }
      case "syntax_error": {
        snap.syntaxErrors += 1;
        break;
      }
      case "test_fail": {
        snap.failingTests += 1;
        break;
      }
      case "test_pass": {
        snap.testProgress.passed = Math.min(
          snap.testProgress.total,
          snap.testProgress.passed + 1,
        );
        break;
      }
      case "code_submit": {
        break;
      }
    }

    this.telemetry.set(event.player, snap);

    if (this.mode === "caster_override" && this.casterLock) {
      return { switched: false, focus: this.casterLock, reason: "caster_override_active" };
    }

    return this.evaluateFocusSwitch(event);
  }

  private evaluateFocusSwitch(
    event: BattleTelemetryEvent,
  ): { switched: boolean; focus: FocusState; reason: string } {
    const now = event.timestamp;
    if (now - this.lastFocusChangeAt < this.config.focusCooldownMs) {
      return { switched: false, focus: this.focus, reason: "cooldown" };
    }

    const p1 = this.getTelemetry("p1");
    const p2 = this.getTelemetry("p2");

    const p1Score = this.excitementScore(p1);
    const p2Score = this.excitementScore(p2);

    const eventScore = this.eventPriorityScore(event);
    const leader = p1Score > p2Score ? "p1" : p2Score > p1Score ? "p2" : null;

    const trigger =
      eventScore >= this.config.excitementThreshold ||
      event.eventType === "code_submit" ||
      event.eventType === "test_fail" ||
      event.eventType === "syntax_error";

    if (!trigger) {
      if (this.focus !== "balanced") {
        this.focus = "balanced";
        this.lastFocusChangeAt = now;
        return { switched: true, focus: "balanced", reason: "decay_to_balanced" };
      }
      return { switched: false, focus: this.focus, reason: "no_excitement" };
    }

    const highPriority =
      event.eventType === "code_submit" ||
      event.eventType === "test_fail" ||
      event.eventType === "syntax_error";

    const target = highPriority ? event.player : (leader ?? event.player);
    const switched = target !== this.focus;
    this.focus = target;
    this.lastFocusChangeAt = now;
    return {
      switched,
      focus: target,
      reason: `excitement_focus_${target}_score_${Math.round(
        leader === "p1" ? p1Score : p2Score!,
      )}`,
    };
  }

  private excitementScore(snap: PlayerTelemetrySnapshot): number {
    let score = 0;
    score += Math.min(snap.burstApm * 0.5, 30);
    score += snap.failingTests * 15;
    score += snap.syntaxErrors * 10;
    const progressRatio =
      snap.testProgress.total > 0
        ? snap.testProgress.passed / snap.testProgress.total
        : null;
    if (progressRatio !== null) {
      score += (1 - progressRatio) * 20;
    }
    return Math.round(score);
  }

  private eventPriorityScore(event: BattleTelemetryEvent): number {
    switch (event.eventType) {
      case "code_submit":
        return 50;
      case "test_fail":
        return 45;
      case "syntax_error":
        return 40;
      case "test_case_eval":
        return Number(event.data.passedCount ?? 0) >= Number(event.data.totalCount ?? 1)
          ? 20
          : 35;
      case "keystroke":
        return Math.min(Number(event.data.deltaLength ?? 0) * 0.5, 25);
      case "test_pass":
        return 10;
      default:
        return 0;
    }
  }

  setCasterOverride(player: PlayerId | null): { switched: boolean; focus: FocusState } {
    this.mode = player ? "caster_override" : "ai";
    this.casterLock = player;
    this.lastFocusChangeAt = Date.now();
    this.focus = player ?? "balanced";
    return { switched: true, focus: this.focus };
  }

  reset(): void {
    this.focus = "balanced";
    this.mode = "ai";
    this.casterLock = null;
    this.lastFocusChangeAt = 0;
    this.eventHistory = [];
    this.telemetry.set("p1", this.emptySnapshot("p1"));
    this.telemetry.set("p2", this.emptySnapshot("p2"));
  }
}

export const studioDirector = new StudioDirector();
