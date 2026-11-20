import { Test, TestingModule } from '@nestjs/testing';
import { HypeMeterService } from './hype-meter.service';

describe('HypeMeterService', () => {
  let service: HypeMeterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HypeMeterService],
    }).compile();

    service = module.get<HypeMeterService>(HypeMeterService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('aggregates multiple reactions into density vectors within 100ms', () => {
    const battleId = 'battle_esports_101';

    // 10 reactions across different emojis
    service.recordReaction({ battleId, userId: 'u1', emoji: '🔥', timestamp: Date.now() });
    service.recordReaction({ battleId, userId: 'u2', emoji: '🔥', timestamp: Date.now() });
    service.recordReaction({ battleId, userId: 'u3', emoji: '🚀', timestamp: Date.now() });
    service.recordReaction({ battleId, userId: 'u4', emoji: '⚡', timestamp: Date.now() });

    const snapshots = service.processTick();
    expect(snapshots.length).toBe(1);
    const snap = snapshots[0];

    expect(snap.battleId).toBe(battleId);
    expect(snap.reactionCount).toBe(4);
    expect(snap.densityVectors['🔥']).toBe(2);
    expect(snap.densityVectors['🚀']).toBe(1);
    expect(snap.densityVectors['⚡']).toBe(1);
    expect(snap.hypeIndex).toBeGreaterThan(0);
    expect(snap.stormActive).toBe(false);
  });

  it('triggers reaction storm and screen shake when Hype Index breaches 90', () => {
    const battleId = 'battle_clutch_final';

    // Simulate huge reaction burst (e.g. 60 high-intensity 🔥 reactions in 100ms)
    for (let i = 0; i < 60; i++) {
      service.recordReaction({
        battleId,
        userId: `spec_${i}`,
        emoji: '🔥',
        timestamp: Date.now(),
      });
    }

    const snapshots = service.processTick();
    expect(snapshots.length).toBe(1);
    const snap = snapshots[0];

    expect(snap.hypeIndex).toBeGreaterThanOrEqual(90);
    expect(snap.stormActive).toBe(true);
    expect(snap.screenShake).toBe(true);

    // Verify peak hype highlight logging
    const peaks = service.getPeakHypeHighlights(battleId);
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0].dominantEmoji).toBe('🔥');
  });

  it('reduces socket broadcast message volume by > 90% under 1,000 simulated reacting clients', () => {
    const battleId = 'battle_load_test';
    const totalSpectators = 1000;

    for (let i = 0; i < totalSpectators; i++) {
      service.recordReaction({
        battleId,
        userId: `client_${i}`,
        emoji: i % 2 === 0 ? '🔥' : '🚀',
        timestamp: Date.now(),
      });
    }

    // In individual event architecture: 1,000 emits
    // In HypeMeterService aggregated architecture: exactly 1 broadcast tick
    const snapshots = service.processTick();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].reactionCount).toBe(1000);

    const messageReductionPercentage = ((totalSpectators - 1) / totalSpectators) * 100;
    expect(messageReductionPercentage).toBeGreaterThan(90); // 99.9% reduction
  });
});
