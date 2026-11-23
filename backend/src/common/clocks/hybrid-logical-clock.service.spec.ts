import { describe, it, expect, beforeEach } from 'vitest';
import {
  HybridLogicalClockService,
  ClockDriftError,
  HlcTimestamp,
} from './hybrid-logical-clock.service';

describe('HybridLogicalClockService (HLC Distributed Monotonic Ordering)', () => {
  let hlcNodeA: HybridLogicalClockService;
  let hlcNodeB: HybridLogicalClockService;
  const fixedTime = 1700000000000;

  beforeEach(() => {
    hlcNodeA = new HybridLogicalClockService('node-A', 250);
    hlcNodeB = new HybridLogicalClockService('node-B', 250);
  });

  it('generates strictly monotonically increasing timestamps on the same physical millisecond', () => {
    const ts1 = hlcNodeA.now(fixedTime);
    const ts2 = hlcNodeA.now(fixedTime);
    const ts3 = hlcNodeA.now(fixedTime);

    expect(ts1.l).toBe(fixedTime);
    expect(ts1.c).toBe(0);

    expect(ts2.l).toBe(fixedTime);
    expect(ts2.c).toBe(1);

    expect(ts3.l).toBe(fixedTime);
    expect(ts3.c).toBe(2);

    expect(HybridLogicalClockService.compare(ts1, ts2)).toBe(-1);
    expect(HybridLogicalClockService.compare(ts2, ts3)).toBe(-1);
  });

  it('resets logical counter when physical clock advances', () => {
    const ts1 = hlcNodeA.now(fixedTime);
    expect(ts1.c).toBe(0);

    const ts2 = hlcNodeA.now(fixedTime + 10);
    expect(ts2.l).toBe(fixedTime + 10);
    expect(ts2.c).toBe(0);
  });

  it('preserves causal order across distributed message exchange with clock skew', () => {
    // Node A creates an event at t=100
    const tsA = hlcNodeA.now(fixedTime + 100);

    // Node B has a slower local clock (t=50, 50ms skew) but receives message from A
    const tsB = hlcNodeB.update(tsA, fixedTime + 50);

    // B's timestamp must reflect causality (tsB > tsA)
    expect(HybridLogicalClockService.compare(tsA, tsB)).toBe(-1);
    expect(tsB.l).toBe(fixedTime + 100);
    expect(tsB.c).toBe(1);
  });

  it('tolerates up to 250ms NTP clock drift without throwing error', () => {
    // Clock drift of 200ms (within 250ms limit)
    expect(() => {
      hlcNodeA.now(fixedTime);
      const futureRemote: HlcTimestamp = {
        l: fixedTime + 200,
        c: 0,
        nodeId: 'node-remote',
      };
      hlcNodeA.update(futureRemote, fixedTime);
    }).not.toThrow();
  });

  it('throws ClockDriftError when NTP clock drift exceeds 250ms', () => {
    expect(() => {
      hlcNodeA.now(fixedTime);
      const hugeDriftRemote: HlcTimestamp = {
        l: fixedTime + 350, // 350ms > 250ms max drift
        c: 0,
        nodeId: 'node-remote',
      };
      hlcNodeA.update(hugeDriftRemote, fixedTime);
    }).toThrow(ClockDriftError);
  });

  it('generates unique, monotonically increasing 64-bit event IDs', () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const id = hlcNodeA.generateEventId(hlcNodeA.now(fixedTime));
      ids.push(id);
    }

    // Verify all 100 IDs are unique and strictly ascending
    for (let i = 1; i < ids.length; i++) {
      expect(BigInt(ids[i]) > BigInt(ids[i - 1])).toBe(true);
    }
  });

  it('deterministically breaks ties using nodeId when l and c are equal', () => {
    const ts1: HlcTimestamp = { l: fixedTime, c: 5, nodeId: 'node-1' };
    const ts2: HlcTimestamp = { l: fixedTime, c: 5, nodeId: 'node-2' };

    expect(HybridLogicalClockService.compare(ts1, ts2)).toBe(-1);
    expect(HybridLogicalClockService.compare(ts2, ts1)).toBe(1);
    expect(HybridLogicalClockService.compare(ts1, ts1)).toBe(0);
  });
});
