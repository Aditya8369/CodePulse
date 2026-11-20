import { describe, it, expect, beforeEach } from "vitest";
import { StudioDirector, type BattleTelemetryEvent } from "./battle-director";

const baseEvent = (overrides: Partial<BattleTelemetryEvent>): BattleTelemetryEvent => ({
  battleId: "battle-1",
  userId: "user-1",
  player: "p1",
  eventType: "keystroke",
  data: {},
  timestamp: Date.now(),
  ...overrides,
});

const now = () => Date.now();

describe("StudioDirector", () => {
  let director: StudioDirector;

  beforeEach(() => {
    director = new StudioDirector({ focusCooldownMs: 50 });
    director.reset();
  });

  it("starts in balanced ai mode", () => {
    expect(director.getFocus()).toBe("balanced");
    expect(director.getMode()).toBe("ai");
    expect(director.getCasterLock()).toBeNull();
  });

  it("switches focus to p1 on code submit within cooldown window", () => {
    const p1Submit = baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() });
    const result = director.ingest(p1Submit);

    expect(result.switched).toBe(true);
    expect(result.focus).toBe("p1");
    expect(director.getFocus()).toBe("p1");
  });

  it("switches focus to p2 on test fail", () => {
    const p2Fail = baseEvent({ player: "p2", eventType: "test_fail", timestamp: now() });
    const result = director.ingest(p2Fail);

    expect(result.switched).toBe(true);
    expect(result.focus).toBe("p2");
  });

  it("switches focus to p1 on syntax error", () => {
    const p1Err = baseEvent({ player: "p1", eventType: "syntax_error", timestamp: now() });
    const result = director.ingest(p1Err);

    expect(result.focus).toBe("p1");
  });

  it("decays back to balanced when no excitement", () => {
    director.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() }));
    expect(director.getFocus()).toBe("p1");

    director.ingest(
      baseEvent({ player: "p2", eventType: "keystroke", data: { deltaLength: 1 }, timestamp: now() + 200 }),
    );
    expect(director.getFocus()).toBe("balanced");
  });

  it("enforces focus cooldown (500ms default)", () => {
    const d = new StudioDirector({ focusCooldownMs: 500 });
    d.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() }));
    expect(d.getFocus()).toBe("p1");

    const second = baseEvent({ player: "p2", eventType: "code_submit", timestamp: now() + 100 });
    const result = d.ingest(second);
    expect(result.switched).toBe(false);
    expect(d.getFocus()).toBe("p1");
  });

  it("caster override locks focus and pauses ai director", () => {
    director.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() }));
    expect(director.getFocus()).toBe("p1");

    const override = director.setCasterOverride("p2");
    expect(override.focus).toBe("p2");
    expect(director.getMode()).toBe("caster_override");
    expect(director.getCasterLock()).toBe("p2");

    while (director.getFocus() !== "p2") {
      director.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() + 1000 }));
    }
    expect(director.getFocus()).toBe("p2");
  });

  it("releasing caster override returns to ai balanced mode", () => {
    director.setCasterOverride("p1");
    expect(director.getMode()).toBe("caster_override");

    director.setCasterOverride(null);
    expect(director.getMode()).toBe("ai");
    expect(director.getCasterLock()).toBeNull();
    expect(director.getFocus()).toBe("balanced");
  });

  it("prioritizes code_submit over low-intensity keystroke", () => {
    const d = new StudioDirector({ excitementThreshold: 40 });
    const t = now();
    d.ingest(baseEvent({ player: "p2", eventType: "keystroke", data: { deltaLength: 5 }, timestamp: t }));
    d.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: t + 200 }));
    expect(d.getFocus()).toBe("p1");
  });

  it("event priority scores rank code_submit highest", () => {
    const d = new StudioDirector();
    const submitScore = d["eventPriorityScore"]({
      ...baseEvent({ eventType: "code_submit" }),
      data: {},
    });
    const failScore = d["eventPriorityScore"]({
      ...baseEvent({ eventType: "test_fail" }),
      data: {},
    });
    const keystrokeScore = d["eventPriorityScore"]({
      ...baseEvent({ eventType: "keystroke", data: { deltaLength: 2 } }),
    });

    expect(submitScore).toBeGreaterThan(failScore);
    expect(failScore).toBeGreaterThan(keystrokeScore);
  });

  it("tracks telemetry snapshots per player", () => {
    director.ingest(
      baseEvent({
        player: "p1",
        eventType: "test_case_eval",
        data: { passedCount: 8, totalCount: 10 },
        timestamp: now(),
      }),
    );

    const snap = director.getTelemetry("p1");
    expect(snap.testProgress).toEqual({ passed: 8, total: 10 });
    expect(snap.failingTests).toBe(2);
  });

  it("resets state completely", () => {
    director.ingest(baseEvent({ player: "p1", eventType: "code_submit", timestamp: now() }));
    expect(director.getFocus()).toBe("p1");

    director.reset();
    expect(director.getFocus()).toBe("balanced");
    expect(director.getMode()).toBe("ai");
    expect(director.getEventHistory()).toHaveLength(0);
  });
});
