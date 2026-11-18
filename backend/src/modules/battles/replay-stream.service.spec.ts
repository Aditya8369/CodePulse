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
});

