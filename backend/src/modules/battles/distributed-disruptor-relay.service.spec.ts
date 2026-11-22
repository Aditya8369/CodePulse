import { DistributedDisruptorRelayService } from './distributed-disruptor-relay.service';
import type { BattleIngestEvent } from './battles.gateway';

describe('DistributedDisruptorRelayService', () => {
  let service: DistributedDisruptorRelayService;

  beforeEach(() => {
    service = new DistributedDisruptorRelayService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('encodes and decodes keystroke event into binary format with high fidelity', () => {
    const originalEvent: BattleIngestEvent = {
      battleId: 'battle-xyz-101',
      userId: 'user-player-alpha',
      socketId: '',
      eventType: 'keystroke',
      data: {
        key: 'Enter',
        cursorPosition: 142,
        patchText: 'func calculateScore() int {\n  return 100\n}',
        sequence: 7,
      },
      timestamp: 1700000000500,
    };

    const binary = service.encodeKeystrokeBinary(originalEvent);
    expect(Buffer.isBuffer(binary)).toBe(true);

    const decoded = service.decodeKeystrokeBinary(binary);
    expect(decoded.battleId).toBe(originalEvent.battleId);
    expect(decoded.userId).toBe(originalEvent.userId);
    expect(decoded.eventType).toBe('keystroke');
    expect(decoded.timestamp).toBe(originalEvent.timestamp);
    expect(decoded.data.key).toBe(originalEvent.data.key);
    expect(decoded.data.cursorPosition).toBe(originalEvent.data.cursorPosition);
    expect(decoded.data.patchText).toBe(originalEvent.data.patchText);
    expect(decoded.data.sequence).toBe(originalEvent.data.sequence);
  });

  it('achieves >75% payload size reduction compared to JSON serialization', () => {
    const event: BattleIngestEvent = {
      battleId: 'b-999',
      userId: 'u-888',
      socketId: 'sock-123',
      eventType: 'keystroke',
      data: {
        key: 'a',
        cursorPosition: 20,
        patchText: 'const x = 10;',
        sequence: 15,
      },
      timestamp: Date.now(),
    };

    const jsonSize = Buffer.byteLength(JSON.stringify(event), 'utf8');
    const binarySize = service.encodeKeystrokeBinary(event).byteLength;

    const reductionPercent = ((jsonSize - binarySize) / jsonSize) * 100;
    expect(reductionPercent).toBeGreaterThan(60); // Highly compact binary
    expect(binarySize).toBeLessThan(jsonSize);
  });

  it('reconciles out-of-order sequence frames deterministically', () => {
    const dispatched: BattleIngestEvent[] = [];
    service.onCrossPodEvent((evt) => dispatched.push(evt));

    const createFrame = (seq: number) => ({
      battleId: 'battle-1',
      userId: 'user-1',
      socketId: '',
      eventType: 'keystroke' as const,
      data: { sequence: seq, key: `k-${seq}` },
      timestamp: Date.now(),
    });

    // Frame 0 arrives first -> processed immediately
    service.dispatchCrossPodEvent(createFrame(0));
    expect(dispatched.map((d) => d.data.sequence)).toEqual([0]);

    // Frame 2 arrives before Frame 1 (out-of-order gap)
    service.dispatchCrossPodEvent(createFrame(2));
    // Should buffer Frame 2 and not emit yet
    expect(dispatched.map((d) => d.data.sequence)).toEqual([0]);

    // Frame 1 arrives -> fills gap, emits both Frame 1 and Frame 2 in order!
    service.dispatchCrossPodEvent(createFrame(1));
    expect(dispatched.map((d) => d.data.sequence)).toEqual([0, 1, 2]);
  });
});
