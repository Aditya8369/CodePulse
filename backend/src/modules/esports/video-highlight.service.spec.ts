import { Test, TestingModule } from '@nestjs/testing';
import { VideoHighlightService, BattleMatchData } from './video-highlight.service';
import { VideoHighlightFormat } from './dto/video-highlight.dto';
import { interpolateValue } from '../../remotion/BattleHighlightComposition';

describe('VideoHighlightService & BattleHighlightComposition', () => {
  let service: VideoHighlightService;

  const mockMatch: BattleMatchData = {
    id: 'match_clutch_999',
    title: 'Grand Finals - Clutch Battle',
    challenger: { id: 'user_1', username: 'pro_coder', rating: 2400 },
    opponent: { id: 'user_2', username: 'rival_master', rating: 2380 },
    winnerId: 'user_1',
    clutchTimeRemainingMs: 1850,
    telemetry: [
      { timestampMs: 10000, userId: 'user_1', action: 'keystroke', code: 'const a = 1;' },
      { timestampMs: 25000, userId: 'user_2', action: 'keystroke', code: 'const b = 2;' },
      { timestampMs: 40000, userId: 'user_1', action: 'test_run', code: 'function f() {}', passedTests: 3, totalTests: 10 },
      { timestampMs: 48000, userId: 'user_2', action: 'test_run', code: 'function g() {}', passedTests: 8, totalTests: 10 },
      { timestampMs: 50000, userId: 'user_1', action: 'submission', code: 'function f() { return 42; }', passedTests: 10, totalTests: 10 },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoHighlightService],
    }).compile();

    service = module.get<VideoHighlightService>(VideoHighlightService);
  });

  describe('extractClutchHighlightWindow', () => {
    it('should extract the final 15-second window ending at the decisive final event', () => {
      const window = service.extractClutchHighlightWindow(mockMatch.telemetry, 15);
      expect(window.windowEndMs).toBe(50000);
      expect(window.windowStartMs).toBe(35000);
      expect(window.timelineEvents.length).toBe(3); // 40000, 48000, 50000
    });

    it('should handle empty telemetry gracefully', () => {
      const window = service.extractClutchHighlightWindow([], 15);
      expect(window.windowStartMs).toBe(0);
      expect(window.windowEndMs).toBe(15000);
      expect(window.timelineEvents).toEqual([]);
    });
  });

  describe('prepareCompositionProps', () => {
    it('should generate Remotion composition props for HORIZONTAL format', () => {
      const props = service.prepareCompositionProps(mockMatch, VideoHighlightFormat.HORIZONTAL);
      expect(props.matchId).toBe(mockMatch.id);
      expect(props.format).toBe('HORIZONTAL');
      expect(props.winner.username).toBe('pro_coder');
      expect(props.winner.clutchTimeRemainingMs).toBe(1850);
      expect(props.opponent.username).toBe('rival_master');
      expect(props.timelineEvents.length).toBeGreaterThan(0);
      expect(props.winnerProgressions.length).toBe(2);
    });

    it('should generate Remotion composition props for VERTICAL format', () => {
      const props = service.prepareCompositionProps(mockMatch, VideoHighlightFormat.VERTICAL);
      expect(props.format).toBe('VERTICAL');
      expect(props.durationInSeconds).toBe(15);
    });
  });

  describe('generateVideoHighlight & getHighlightById', () => {
    it('should generate video highlight metadata with Open Graph social card tags within 30 seconds', async () => {
      const startTime = Date.now();
      const metadata = await service.generateVideoHighlight(
        'match_clutch_999',
        VideoHighlightFormat.VERTICAL,
        mockMatch,
      );
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(30000);
      expect(metadata.highlightId).toBeDefined();
      expect(metadata.battleId).toBe('match_clutch_999');
      expect(metadata.format).toBe(VideoHighlightFormat.VERTICAL);
      expect(metadata.dimensions).toEqual({ width: 1080, height: 1920 });
      expect(metadata.videoUrl).toContain('.mp4');
      expect(metadata.openGraph.cardType).toBe('player');
      expect(metadata.openGraph.title).toContain('pro_coder');
      expect(metadata.openGraph.mimeType).toBe('video/mp4');

      const retrieved = service.getHighlightById(metadata.highlightId);
      expect(retrieved).toEqual(metadata);
    });

    it('should throw NotFoundException for unknown highlight id', () => {
      expect(() => service.getHighlightById('non_existent_id')).toThrow();
    });
  });

  describe('Remotion pure interpolation helper', () => {
    it('should calculate interpolated values correctly', () => {
      expect(interpolateValue(0, [0, 100], [0, 500])).toBe(0);
      expect(interpolateValue(50, [0, 100], [0, 500])).toBe(250);
      expect(interpolateValue(100, [0, 100], [0, 500])).toBe(500);
      expect(interpolateValue(-10, [0, 100], [0, 500])).toBe(0);
      expect(interpolateValue(120, [0, 100], [0, 500])).toBe(500);
    });
  });
});
