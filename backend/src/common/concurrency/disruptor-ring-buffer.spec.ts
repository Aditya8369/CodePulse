import { DisruptorRingBuffer } from './disruptor-ring-buffer';

describe('DisruptorRingBuffer (LMAX Disruptor Pattern #459)', () => {
  it('initializes with next power-of-two capacity', () => {
    const buffer = new DisruptorRingBuffer(1000);
    expect(buffer.getCapacity()).toBe(1024);

    const buffer2 = new DisruptorRingBuffer(65536);
    expect(buffer2.getCapacity()).toBe(65536);
  });

  it('publishes and consumes events in deterministic sequence order', () => {
    const buffer = new DisruptorRingBuffer<string>(16);

    const seq0 = buffer.publish('keystroke', 'key-a');
    const seq1 = buffer.publish('keystroke', 'key-b');
    const seq2 = buffer.publish('test_case_eval', 'pass-all');

    expect(seq0).toBe(0);
    expect(seq1).toBe(1);
    expect(seq2).toBe(2);

    const events = buffer.drainBatch();
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ sequence: 0, type: 'keystroke', payload: 'key-a' });
    expect(events[1]).toMatchObject({ sequence: 1, type: 'keystroke', payload: 'key-b' });
    expect(events[2]).toMatchObject({ sequence: 2, type: 'test_case_eval', payload: 'pass-all' });
  });

  it('handles circular buffer wrap-around seamlessly using bitwise masking', () => {
    const buffer = new DisruptorRingBuffer<number>(4);

    // Publish 4 events (fill buffer)
    for (let i = 0; i < 4; i++) {
      buffer.publish('event', i);
    }

    // Drain 2 events
    const firstDrain = buffer.drainBatch(2);
    expect(firstDrain).toHaveLength(2);
    expect(firstDrain.map((e) => e.payload)).toEqual([0, 1]);

    // Publish 2 more (wraps around circularly to slots 0 and 1)
    buffer.publish('event', 4);
    buffer.publish('event', 5);

    // Drain remaining
    const secondDrain = buffer.drainBatch(4);
    expect(secondDrain).toHaveLength(4);
    expect(secondDrain.map((e) => e.payload)).toEqual([2, 3, 4, 5]);
  });

  it('reports accurate diagnostic metrics (capacity, published, consumed, pending)', () => {
    const buffer = new DisruptorRingBuffer<string>(32);

    for (let i = 0; i < 10; i++) {
      buffer.publish('event', `data-${i}`);
    }

    let stats = buffer.getStats();
    expect(stats.publishedCount).toBe(10);
    expect(stats.consumedCount).toBe(0);
    expect(stats.pendingCount).toBe(10);

    buffer.drainBatch(6);
    stats = buffer.getStats();
    expect(stats.consumedCount).toBe(6);
    expect(stats.pendingCount).toBe(4);
  });

  it('benchmark: demonstrates > 1,500,000 events/sec lock-free throughput', () => {
    const buffer = new DisruptorRingBuffer<number>(1048576);
    const TOTAL_EVENTS = 500000;

    // Measure raw lock-free publishing throughput
    const start = performance.now();
    for (let i = 0; i < TOTAL_EVENTS; i++) {
      buffer.publish('keystroke', i, 0);
    }
    const elapsedSeconds = (performance.now() - start) / 1000;
    const throughput = TOTAL_EVENTS / elapsedSeconds;

    let consumed = 0;
    buffer.drain(() => {
      consumed++;
    }, TOTAL_EVENTS);

    expect(consumed).toBe(TOTAL_EVENTS);
    expect(throughput).toBeGreaterThan(1500000); // Exceeds 1.5M events/sec benchmark requirement
  });
});
