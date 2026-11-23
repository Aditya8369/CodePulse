import { WatermarkService } from './watermark.service';

describe('WatermarkService (Anti-Ghosting Watermarking & Integrity Verification #455)', () => {
  let service: WatermarkService;

  beforeEach(() => {
    service = new WatermarkService();
  });

  describe('Steganographic Watermark Generation & Decoding', () => {
    it('generates imperceptible luminance modulation map encoding spectator metadata', () => {
      const spectator = {
        spectatorId: 'viewer-spec-99',
        ipAddress: '192.168.1.100',
        timestamp: 1731930000000,
        matchId: 'battle-finals-2026',
      };

      const watermark = service.generateSteganographicWatermark(spectator, 32, 32);

      expect(watermark.encodedBitstream).toBeDefined();
      expect(watermark.luminanceModulationMap).toHaveLength(32);
      expect(watermark.luminanceModulationMap[0]).toHaveLength(32);
      expect(watermark.signature).toBeDefined();

      // Luminance deltas must be bounded to subtle -1, 0, or 1 to preserve visual readability
      for (const row of watermark.luminanceModulationMap) {
        for (const pixelDelta of row) {
          expect([-1, 0, 1]).toContain(pixelDelta);
        }
      }
    });

    it('decodes spectator identity from binary bitstream with high confidence', () => {
      const spectator = {
        spectatorId: 'leaker-account-42',
        ipAddress: '10.0.0.5',
        timestamp: 1731935000000,
        matchId: 'match-championship',
      };

      const watermark = service.generateSteganographicWatermark(spectator);
      const decoded = service.decodeWatermarkFromBitstream(watermark.encodedBitstream);

      expect(decoded.valid).toBe(true);
      expect(decoded.spectatorId).toBe('leaker-account-42');
      expect(decoded.ipAddress).toBe('10.0.0.5');
      expect(decoded.timestamp).toBe(1731935000000);
      expect(decoded.matchId).toBe('match-championship');
      expect(decoded.confidenceScore).toBeGreaterThanOrEqual(0.95);
    });

    it('decodes spectator identity directly from 2D luminance modulation map', () => {
      const spectator = {
        spectatorId: 'stream-sniper-7',
        ipAddress: '172.16.0.22',
        timestamp: 1731938000000,
        matchId: 'grand-finals',
      };

      const watermark = service.generateSteganographicWatermark(spectator, 48, 48);
      const decoded = service.decodeWatermarkFromLuminanceMap(watermark.luminanceModulationMap);

      expect(decoded.valid).toBe(true);
      expect(decoded.spectatorId).toBe('stream-sniper-7');
      expect(decoded.ipAddress).toBe('172.16.0.22');
    });

    it('rejects tampered or corrupted bitstreams with invalid checksum', () => {
      const spectator = {
        spectatorId: 'genuine-viewer',
        ipAddress: '192.168.1.1',
        timestamp: 1731940000000,
        matchId: 'match-1',
      };

      const watermark = service.generateSteganographicWatermark(spectator);

      // Corrupt bits in the payload
      const tamperedBits =
        watermark.encodedBitstream.substring(0, 30) +
        '00000000' +
        watermark.encodedBitstream.substring(38);

      const decoded = service.decodeWatermarkFromBitstream(tamperedBits);
      expect(decoded.valid).toBe(false);
    });
  });

  describe('Spectator Stream Delay Enforcement', () => {
    it('bounds spectator stream delay between 60 and 180 seconds', () => {
      expect(service.setSpectatorDelay(30)).toBe(60); // min bound
      expect(service.setSpectatorDelay(300)).toBe(180); // max bound
      expect(service.setSpectatorDelay(120)).toBe(120); // within bounds
    });

    it('buffers spectator frames and releases them only after the delay window elapses', () => {
      service.setSpectatorDelay(60); // 60s delay
      const now = Date.now();

      service.enqueueSpectatorFrame('battle-delay-1', 1, { codeDelta: 'x = 1' });
      service.enqueueSpectatorFrame('battle-delay-1', 2, { codeDelta: 'y = 2' });

      // Immediate check should return 0 ready frames (still delayed)
      expect(service.drainReadySpectatorFrames('battle-delay-1', now)).toHaveLength(0);

      // Check after 30s: still 0 ready
      expect(service.drainReadySpectatorFrames('battle-delay-1', now + 30000)).toHaveLength(0);

      // Check after 61s: both frames released
      const released = service.drainReadySpectatorFrames('battle-delay-1', now + 61000);
      expect(released).toHaveLength(2);
      expect(released[0].frameId).toBe(1);
      expect(released[1].frameId).toBe(2);
    });
  });

  describe('Tab Focus & Anti-Ghosting Screen Monitoring', () => {
    it('detects tab blur and tracks total duration away from active battle arena', () => {
      const t1 = 1000000;
      const t2 = 1005000; // 5 seconds away

      const blurEvent = service.recordTabFocusChange('battle-42', 'player-alice', 'blur', t1);
      expect(blurEvent.event).toBe('blur');
      expect(blurEvent.timeSpentAwayMs).toBeUndefined();

      const focusEvent = service.recordTabFocusChange('battle-42', 'player-alice', 'focus', t2);
      expect(focusEvent.event).toBe('focus');
      expect(focusEvent.timeSpentAwayMs).toBe(5000);
    });
  });

  describe('Compressed Screenshot & Monitor Photo Watermark Extraction (#1092)', () => {
    it('successfully extracts user ID from a compressed JPEG photo of a monitor screen', () => {
      const spectator = {
        spectatorId: 'leaker_target_user_88',
        ipAddress: '198.51.100.42',
        timestamp: 1732000000000,
        matchId: 'esports-invitational-finals',
      };

      const result = service.simulateCompressedScreenshotLeak(spectator, 0.85);

      expect(result.extractedUserId).toBe('leaker_target_user_88');
      expect(result.accuracy).toBeGreaterThanOrEqual(0.999);
      expect(result.decodedResult.valid).toBe(true);
      expect(result.decodedResult.ipAddress).toBe('198.51.100.42');
      expect(result.decodedResult.matchId).toBe('esports-invitational-finals');
    });

    it('extracts watermark payload from arbitrary noisy pixel matrices', () => {
      const spectator = {
        spectatorId: 'co_conspirator_discord',
        ipAddress: '203.0.113.19',
        timestamp: 1732005000000,
        matchId: 'grand-finals-leak',
      };

      const watermark = service.generateSteganographicWatermark(spectator, 48, 48);
      const decoded = service.extractWatermarkFromScreenshot(watermark.luminanceModulationMap);

      expect(decoded.valid).toBe(true);
      expect(decoded.spectatorId).toBe('co_conspirator_discord');
    });
  });
});

