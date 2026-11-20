import { Test, TestingModule } from '@nestjs/testing';
import { CasterStudioService } from './caster-studio.service';

describe('CasterStudioService & Director Controls', () => {
  let service: CasterStudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CasterStudioService],
    }).compile();

    service = module.get<CasterStudioService>(CasterStudioService);
  });

  it('initializes default studio state for tournament match', () => {
    const state = service.getOrCreateStudioState('tourney_2026_finals');
    expect(state.tournamentId).toBe('tourney_2026_finals');
    expect(state.activeCamera).toBe('split_screen');
    expect(state.lowerThird.visible).toBe(false);
    expect(state.telemetry.player1.wpm).toBeGreaterThan(0);
  });

  it('switches active camera with sub-50ms timestamp updates', () => {
    const start = Date.now();
    const updated = service.switchActiveCamera('tourney_2026_finals', 'player1', 'director_01');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(updated.activeCamera).toBe('player1');
    expect(updated.directorId).toBe('director_01');
  });

  it('triggers lower-third graphic overlay state', () => {
    const updated = service.updateLowerThird(
      'tourney_2026_finals',
      {
        visible: true,
        title: 'Championship Match Point',
        subtitle: 'dev_alex needs 1 more test case',
      },
      'director_01',
    );

    expect(updated.lowerThird.visible).toBe(true);
    expect(updated.lowerThird.title).toBe('Championship Match Point');
  });

  it('triggers stat comparison graphic between contestants', () => {
    const updated = service.triggerStatComparison(
      'tourney_2026_finals',
      {
        visible: true,
        metric: 'Code Complexity & Execution Time',
        player1Value: 'O(N) - 14ms',
        player2Value: 'O(N^2) - 180ms',
        highlightLeader: 'player1',
      },
      'director_01',
    );

    expect(updated.statComparison.visible).toBe(true);
    expect(updated.statComparison.highlightLeader).toBe('player1');
  });

  it('triggers slow-mo instant replay overlay', () => {
    const updated = service.triggerSlowMoReplay(
      'tourney_2026_finals',
      {
        active: true,
        clipStartSec: 45,
        speed: 0.25,
        replayTitle: 'Buzzer Beater Submission Replay',
      },
      'director_01',
    );

    expect(updated.slowMoReplay.active).toBe(true);
    expect(updated.slowMoReplay.speed).toBe(0.25);
  });

  it('synchronizes live telemetry updates', () => {
    const updated = service.updateTelemetry('tourney_2026_finals', {
      player1: { username: 'dev_alex', wpm: 125, testsPassed: 10, totalTests: 10, winProbability: 95 },
    });

    expect(updated.telemetry.player1.wpm).toBe(125);
    expect(updated.telemetry.player1.winProbability).toBe(95);
  });

  it('enforces role-based director permissions', () => {
    service.registerCasterAuth('client_spec', {
      userId: 'user_viewer',
      role: 'CASTER', // Caster does not have director mutation override
      tournamentId: 'tourney_2026_finals',
    });

    expect(() =>
      service.verifyDirectorPermission('client_spec', 'tourney_2026_finals'),
    ).toThrow();
  });
});

