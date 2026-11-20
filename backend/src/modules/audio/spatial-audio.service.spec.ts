import { Test, TestingModule } from '@nestjs/testing';
import { SpatialAudioService } from './spatial-audio.service';

describe('SpatialAudioService & VAD Engine', () => {
  let service: SpatialAudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpatialAudioService],
    }).compile();

    service = module.get<SpatialAudioService>(SpatialAudioService);
  });

  it('registers Player 1 with default -0.3 left stereo panning', () => {
    const p1 = service.registerParticipant('battle_audio_1', 'user_p1', 'player1');
    expect(p1.spatialConfig.panning).toBe(-0.3);
    expect(p1.role).toBe('player1');
    expect(p1.spatialConfig.agcEnabled).toBe(true);
    expect(p1.spatialConfig.noiseSuppression).toBe(true);
  });

  it('registers Player 2 with default +0.3 right stereo panning', () => {
    const p2 = service.registerParticipant('battle_audio_1', 'user_p2', 'player2');
    expect(p2.spatialConfig.panning).toBe(0.3);
    expect(p2.role).toBe('player2');
  });

  it('calculates bandwidth savings when VAD suppresses non-speech packets (60%+ savings)', () => {
    service.registerParticipant('battle_audio_2', 'user_noisy', 'player1');

    // Simulate 40 speaking packets and 60 silence/keyboard noise packets suppressed by VAD
    for (let i = 0; i < 40; i++) {
      service.updateVadState('battle_audio_2', 'user_noisy', true);
    }
    for (let i = 0; i < 60; i++) {
      service.updateVadState('battle_audio_2', 'user_noisy', false);
    }

    const metrics = service.getRoomBandwidthMetrics('battle_audio_2');
    expect(metrics.totalTransmitted).toBe(40);
    expect(metrics.totalSuppressed).toBe(60);
    expect(metrics.bandwidthSavedPercent).toBe(60.0);
  });

  it('allows spectators to adjust individual contestant volume and panning', () => {
    service.registerParticipant('battle_audio_3', 'user_p1', 'player1');

    const updated = service.updateSpatialConfig('battle_audio_3', 'user_p1', {
      volume: 0.75,
      panning: -0.5,
    });

    expect(updated).toBeDefined();
    expect(updated?.volume).toBe(0.75);
    expect(updated?.panning).toBe(-0.5);
  });

  it('handles participant leave and room cleanup', () => {
    service.registerParticipant('battle_audio_4', 'user_temp', 'spectator');
    expect(service.getRoomAudioLayout('battle_audio_4').length).toBe(1);

    service.removeParticipant('battle_audio_4', 'user_temp');
    expect(service.getRoomAudioLayout('battle_audio_4').length).toBe(0);
  });
});

