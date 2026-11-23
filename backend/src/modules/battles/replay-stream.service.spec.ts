import { Test, TestingModule } from '@nestjs/testing';
import { ReplayStreamService } from './replay-stream.service';
import { ScyllaKeystrokeService } from '../analytics/scylla-keystroke.service';

describe('ReplayStreamService', () => {
  let service: ReplayStreamService;
  let scyllaService: ScyllaKeystrokeService;

  beforeEach(async () => {
    scyllaService = new ScyllaKeystrokeService({
      keyspace: 'codepulse_replay_test',
      table: 'keystrokes_replay_test',
      batchFlushIntervalMs: 20,
    });
    await scyllaService.onModuleInit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayStreamService,
        {
          provide: ScyllaKeystrokeService,
          useValue: scyllaService,
        },
      ],
    }).compile();

    service = module.get<ReplayStreamService>(ReplayStreamService);
  });

  afterEach(async () => {
    await scyllaService.onModuleDestroy();
  });

  it('retrieves sequential match replay timeline with relative offsets for scrubbing', async () => {
    const battleId = 'replay-battle-xyz';
    const baseDate = new Date('2026-11-18T10:00:00Z');

    // Ingest events
    await service.ingestKeystrokesBulk([
      {
        battleId,
        timestamp: baseDate,
        playerId: 'p1',
        delta: 'def solve():',
      },
      {
        battleId,
        timestamp: new Date(baseDate.getTime() + 1500),
        playerId: 'p1',
        delta: '    pass',
      },
      {
        battleId,
        timestamp: new Date(baseDate.getTime() + 3000),
        playerId: 'p2',
        delta: 'const x = 1;',
      },
    ]);

    await scyllaService.flushBatch();

    const timeline = await service.getMatchReplayTimeline(battleId);

    expect(timeline.battleId).toBe(battleId);
    expect(timeline.totalEvents).toBe(3);
    expect(timeline.durationMs).toBe(3000);
    expect(timeline.frames.length).toBe(3);
    expect(timeline.frames[0].relativeOffsetMs).toBe(0);
    expect(timeline.frames[1].relativeOffsetMs).toBe(1500);
    expect(timeline.frames[2].relativeOffsetMs).toBe(3000);
    expect(timeline.frames[2].playerId).toBe('p2');
  });

  it('handles empty replay queries gracefully', async () => {
    const timeline = await service.getMatchReplayTimeline('empty-battle');
    expect(timeline.totalEvents).toBe(0);
    expect(timeline.frames).toEqual([]);
  });

  describe('Remotion Video Highlight Generator (#1091)', () => {
    it('renders a 30-second 1080p MP4 highlight reel in under 15 seconds', async () => {
      const battleId = 'clutch-battle-101';
      const result = await service.renderDecisiveHighlightClip(battleId, {
        durationSeconds: 30,
        format: 'HORIZONTAL',
      });

      expect(result.battleId).toBe(battleId);
      expect(result.durationSeconds).toBe(30);
      expect(result.resolution).toBe('1920x1080');
      expect(result.renderTimeMs).toBeLessThan(15000); // Renders in under 15 seconds SLA
      expect(result.codec).toBe('h264');
      expect(result.videoUrl).toContain('.mp4');
      expect(result.socialPlatformsReady).toContain('twitter');
      expect(result.socialPlatformsReady).toContain('linkedin');
    });

    it('supports VERTICAL (1080x1920) format for TikTok / Reels / Shorts', async () => {
      const battleId = 'reels-battle-202';
      const result = await service.renderDecisiveHighlightClip(battleId, {
        durationSeconds: 30,
        format: 'VERTICAL',
      });

      expect(result.resolution).toBe('1080x1920');
      expect(result.renderTimeMs).toBeLessThan(15000);
      expect(result.socialPlatformsReady).toContain('tiktok');
      expect(result.socialPlatformsReady).toContain('youtube_shorts');
    });
  });
});

