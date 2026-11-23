import { JitterBufferService } from './jitter-buffer.service';
import { KeystrokePacket } from './jitter-buffer.types';
import { PacketResequencer } from './packet-resequencer';

describe('PacketResequencer & JitterBufferService', () => {
  describe('PacketResequencer', () => {
    let resequencer: PacketResequencer;

    beforeEach(() => {
      resequencer = new PacketResequencer(1, 100);
    });

    it('should immediately drain in-order packets', () => {
      const p1: KeystrokePacket = {
        sequenceNumber: 1,
        timestamp: 1000,
        arrivalTimestamp: 1020,
        packetType: 'KEYSTROKE',
        battleId: 'b-1',
        playerId: 'p-1',
        payload: { key: 'a' },
      };

      const out = resequencer.ingestPacket(p1);
      expect(out.length).toBe(1);
      expect(out[0].sequenceNumber).toBe(1);
      expect(resequencer.getExpectedSequenceNumber()).toBe(2);
    });

    it('should buffer out-of-order packets and drain in correct sequence once missing packets arrive', () => {
      // Arriving sequence: 1, 3, 4, 2
      const makePkt = (seq: number): KeystrokePacket => ({
        sequenceNumber: seq,
        timestamp: 1000 + seq * 16,
        arrivalTimestamp: 1020 + seq * 16,
        packetType: 'KEYSTROKE',
        battleId: 'b-1',
        playerId: 'p-1',
        payload: { key: String.fromCharCode(96 + seq) },
      });

      // Packet 1 arrives -> drains 1
      const out1 = resequencer.ingestPacket(makePkt(1));
      expect(out1.map((p) => p.sequenceNumber)).toEqual([1]);

      // Packet 3 arrives -> buffered (missing 2)
      const out3 = resequencer.ingestPacket(makePkt(3));
      expect(out3.length).toBe(0);

      // Packet 4 arrives -> buffered
      const out4 = resequencer.ingestPacket(makePkt(4));
      expect(out4.length).toBe(0);

      // Packet 2 arrives -> drains 2, 3, 4!
      const out2 = resequencer.ingestPacket(makePkt(2));
      expect(out2.map((p) => p.sequenceNumber)).toEqual([2, 3, 4]);
      expect(resequencer.getExpectedSequenceNumber()).toBe(5);
    });

    it('should skip gaps upon deadline expiry to unblock playout pipeline', () => {
      const makePkt = (seq: number): KeystrokePacket => ({
        sequenceNumber: seq,
        timestamp: 1000 + seq * 16,
        arrivalTimestamp: 1020 + seq * 16,
        packetType: 'KEYSTROKE',
        battleId: 'b-1',
        playerId: 'p-1',
        payload: {},
      });

      // Packet 5 arrives while expecting 1
      resequencer.ingestPacket(makePkt(5));
      expect(resequencer.getBufferSize()).toBe(1);

      // Force skip gap
      const recovered = resequencer.skipGap();
      expect(recovered.length).toBe(1);
      expect(recovered[0].sequenceNumber).toBe(5);
      expect(resequencer.getExpectedSequenceNumber()).toBe(6);
    });
  });

  describe('JitterBufferService', () => {
    let service: JitterBufferService;

    beforeEach(() => {
      service = new JitterBufferService({
        minPlayoutDelayMs: 20,
        maxPlayoutDelayMs: 300,
        targetFrameRateFps: 60,
        maxBurstJitterMs: 200,
      });
    });

    afterEach(() => {
      service.onModuleDestroy();
    });

    it('should calculate RFC 3550 statistical jitter and adapt playout delay dynamically', () => {
      const baseTime = 10000;

      // Packet 1: Normal transit (30ms latency)
      const res1 = service.ingestPacket({
        sequenceNumber: 1,
        timestamp: baseTime,
        arrivalTimestamp: baseTime + 30,
        packetType: 'KEYSTROKE',
        battleId: 'arena-99',
        playerId: 'player-x',
        payload: { key: 'w' },
      });

      // Packet 2: High jitter burst (+150ms delay)
      const res2 = service.ingestPacket({
        sequenceNumber: 2,
        timestamp: baseTime + 16,
        arrivalTimestamp: baseTime + 16 + 180, // 180ms latency (150ms jitter spike)
        packetType: 'KEYSTROKE',
        battleId: 'arena-99',
        playerId: 'player-x',
        payload: { key: 'a' },
      });

      expect(res2.estimatedJitterMs).toBeGreaterThan(0);
      expect(res2.targetPlayoutDelayMs).toBeGreaterThan(res1.targetPlayoutDelayMs);
    });

    it('should reconstruct smooth 60fps playout frame from buffered packets', () => {
      const baseTime = 50000;

      service.ingestPacket({
        sequenceNumber: 1,
        timestamp: baseTime,
        arrivalTimestamp: baseTime + 20,
        packetType: 'KEYSTROKE',
        battleId: 'arena-88',
        playerId: 'player-y',
        payload: { key: 's' },
      });

      // Play out at baseTime + 200ms
      const frame = service.generateNextPlayoutFrame('arena-88', 'player-y', baseTime + 200);
      expect(frame).not.toBeNull();
      expect(frame?.packets.length).toBe(1);
      expect(frame?.packets[0].sequenceNumber).toBe(1);
    });

    it('should withstand 200ms burst jitter without dropping frames', () => {
      const baseTime = 100000;

      // Send 5 packets with fluctuating arrival times up to 180ms burst
      for (let i = 1; i <= 5; i++) {
        const jitterBurst = i % 2 === 0 ? 160 : 20;
        service.ingestPacket({
          sequenceNumber: i,
          timestamp: baseTime + i * 16,
          arrivalTimestamp: baseTime + i * 16 + jitterBurst,
          packetType: 'KEYSTROKE',
          battleId: 'arena-77',
          playerId: 'player-z',
          payload: { action: 'CAST_SPELL' },
        });
      }

      const metrics = service.getMetrics('arena-77');
      expect(metrics.totalPacketsReceived).toBe(5);
      expect(metrics.droppedLatePacketsCount).toBe(0); // Zero frames dropped!
    });
  });
});
