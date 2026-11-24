import {
  DisruptorRingBuffer,
  BusySpinWaitStrategy,
  YieldingWaitStrategy,
  SleepingWaitStrategy,
  BlockingWaitStrategy,
} from './disruptor-ring-buffer';

describe('DisruptorRingBuffer (LMAX Disruptor Pattern & Adaptive Backpressure #530 / #1051)', () => {
  it('initializes with next power-of-two capacity', () => {
    const buffer = new DisruptorRingBuffer(1000);
    expect(buffer.getCapacity()).toBe(1024);

    const buffer2 = new DisruptorRingBuffer(65536);
    expect(buffer2.getCapacity()).toBe(65536);
    buffer.destroy();
    buffer2.destroy();
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
    buffer.destroy();
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
    buffer.destroy();
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
    buffer.destroy();
  });

  it('activates adaptive socket backpressure when event loop delay exceeds 50ms', () => {
    const buffer = new DisruptorRingBuffer<string>({ capacity: 64, lagThresholdMs: 50 });

    expect(buffer.isBackpressureActive()).toBe(false);
    expect(buffer.shouldPauseSocket()).toBe(false);

    // Normal publishing under healthy conditions
    const seqNormal = buffer.publish('emoji_reaction', '🔥', 'LOW');
    expect(seqNormal).toBe(0);

    // Simulate event loop lag spike > 50ms (e.g. 75ms)
    buffer.setSimulatedLag(75);
    expect(buffer.isBackpressureActive()).toBe(true);
    expect(buffer.shouldPauseSocket()).toBe(true);

    // Low priority visual reactions are shed/dropped to protect the event loop
    const seqDropped = buffer.publish('emoji_reaction', '🎉', 'LOW');
    expect(seqDropped).toBe(-1);

    // Critical battle submission events MUST still be accepted
    const seqCritical = buffer.publish('battle_submission', 'solution_code', 'CRITICAL');
    expect(seqCritical).toBe(1);

    const stats = buffer.getStats();
    expect(stats.droppedLowPriorityCount).toBe(1);
    expect(stats.eventLoopDelayMs).toBe(75);
    expect(stats.isBackpressureActive).toBe(true);

    // Recover lag back below threshold
    buffer.setSimulatedLag(10);
    expect(buffer.isBackpressureActive()).toBe(false);

    const seqRecovered = buffer.publish('emoji_reaction', '👍', 'LOW');
    expect(seqRecovered).toBe(2);

    buffer.destroy();
  });

  it('performs thread-safe sequence claiming using Atomics.compareExchange (CAS)', () => {
    const buffer = new DisruptorRingBuffer<string>({
      capacity: 64,
      producerType: 'MULTI',
    });

    const seq1 = buffer.publishWithCas('keystroke', 'key-1');
    const seq2 = buffer.publishWithCas('keystroke', 'key-2');
    const seq3 = buffer.publishWithCas('cursor', 'pos-3');

    expect(seq1).toBe(0);
    expect(seq2).toBe(1);
    expect(seq3).toBe(2);

    expect(buffer.getProducerSequence()).toBe(2);

    const drained = buffer.drainBatch();
    expect(drained).toHaveLength(3);
    expect(drained[0].payload).toBe('key-1');
    expect(drained[1].payload).toBe('key-2');
    expect(drained[2].payload).toBe('pos-3');

    buffer.destroy();
  });

  describe('Wait Strategies', () => {
    it('executes BusySpinWaitStrategy without blocking', () => {
      const waitStrategy = new BusySpinWaitStrategy();
      let available = 0;
      const result = waitStrategy.waitFor(0, () => available);
      expect(result).toBe(0);
    });

    it('executes YieldingWaitStrategy for micro-yield backoff', () => {
      const waitStrategy = new YieldingWaitStrategy(10);
      let available = 5;
      const result = waitStrategy.waitFor(3, () => available);
      expect(result).toBe(5);
    });

    it('executes SleepingWaitStrategy progressive backoff', () => {
      const waitStrategy = new SleepingWaitStrategy(5, 5);
      let available = 10;
      const result = waitStrategy.waitFor(5, () => available);
      expect(result).toBe(10);
    });

    it('executes BlockingWaitStrategy with signal notification', () => {
      const sab = new SharedArrayBuffer(16);
      const notifyBuffer = new Int32Array(sab);
      const waitStrategy = new BlockingWaitStrategy(notifyBuffer, 0);

      expect(() => waitStrategy.signalAllWhenBlocking()).not.toThrow();
      const result = waitStrategy.waitFor(0, () => 2);
      expect(result).toBe(2);
    });
  });

  describe('High-Throughput Benchmark (100,000 events/second & P99 < 2ms)', () => {
    it('sustains 100,000 synthetic events/sec with P99 latency under 2ms and zero drops', () => {
      const benchmark = DisruptorRingBuffer.benchmarkLoad(100000);

      expect(benchmark.totalEvents).toBe(100000);
      expect(benchmark.eventsPerSecond).toBeGreaterThan(100000);
      expect(benchmark.p99LatencyMs).toBeLessThan(2.0);
      expect(benchmark.zeroDrops).toBe(true);
    });
  });
});
