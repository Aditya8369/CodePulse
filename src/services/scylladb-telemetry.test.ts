import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScyllaDbTelemetryClient } from './scylladb-telemetry';

describe('ScyllaDbTelemetryClient Vitest Suite', () => {
  let client: ScyllaDbTelemetryClient;

  beforeEach(() => {
    ScyllaDbTelemetryClient.resetInstance();
    client = ScyllaDbTelemetryClient.getInstance();
  });

  afterEach(() => {
    client.clear();
    vi.restoreAllMocks();
  });

  describe('Batch Writing Telemetry Events', () => {
    it('buffers high-frequency keystrokes and flushes batch to backend ScyllaDB', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ingestedCount: 50, ack: true }),
      });

      for (let i = 0; i < 50; i++) {
        client.queueKeystroke({
          battleId: 'match-vitest-1',
          playerId: 'player-vitest-1',
          timestamp: new Date(Date.now() + i * 20),
          charDelta: JSON.stringify({ char: 'k', cursor: i }),
          actionType: 'KEY_PRESS',
          wpm: 115,
        });
      }

      expect(client.getBufferSize()).toBe(50);

      const result = await client.flushBatch();
      expect(result.ack).toBe(true);
      expect(result.ingestedCount).toBe(50);
      expect(result.failover).toBe(false);
      expect(client.getBufferSize()).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Time-Series Querying', () => {
    it('retrieves chronological match timeline events for replay scrubbing', async () => {
      const mockTimeline = [
        {
          battleId: 'match-vitest-2',
          playerId: 'p1',
          timestamp: '2026-11-21T10:00:00.000Z',
          charDelta: 'c',
          actionType: 'KEY_PRESS',
        },
        {
          battleId: 'match-vitest-2',
          playerId: 'p1',
          timestamp: '2026-11-21T10:00:00.500Z',
          charDelta: 'o',
          actionType: 'KEY_PRESS',
        },
        {
          battleId: 'match-vitest-2',
          playerId: 'p1',
          timestamp: '2026-11-21T10:00:01.000Z',
          charDelta: 'd',
          actionType: 'KEY_PRESS',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTimeline,
      });

      const events = await client.getBattleTimeline('match-vitest-2');
      expect(events.length).toBe(3);
      expect(events[0].charDelta).toBe('c');
      expect(events[1].charDelta).toBe('o');
      expect(events[2].charDelta).toBe('d');
    });
  });

  describe('Driver Failover & Offline Resilience', () => {
    it('gracefully switches to fallback store when ScyllaDB driver/network fails without dropping data', async () => {
      // Simulate network / driver failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to ScyllaDB node'));

      client.queueKeystroke({
        battleId: 'match-failover',
        playerId: 'p1',
        timestamp: new Date('2026-11-21T11:00:00Z'),
        charDelta: 'failover-protected-1',
      });
      client.queueKeystroke({
        battleId: 'match-failover',
        playerId: 'p1',
        timestamp: new Date('2026-11-21T11:00:01Z'),
        charDelta: 'failover-protected-2',
      });

      const flushRes = await client.flushBatch();
      expect(flushRes.ack).toBe(true);
      expect(flushRes.failover).toBe(true);
      expect(flushRes.ingestedCount).toBe(2);

      // Verify data is retrieved from fallback store in chronological order
      const timeline = await client.getBattleTimeline('match-failover');
      expect(timeline.length).toBe(2);
      expect(timeline[0].charDelta).toBe('failover-protected-1');
      expect(timeline[1].charDelta).toBe('failover-protected-2');
    });
  });
});

