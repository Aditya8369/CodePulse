import {
  BroadcastControllerService,
  OBS_CANVAS_RESOLUTION,
} from './broadcast-controller.service';

describe('BroadcastControllerService (Tournament Control Room)', () => {
  let service: BroadcastControllerService;

  beforeEach(() => {
    service = new BroadcastControllerService();
  });

  it('initializes a broadcast session configured for 1920x1080 60FPS OBS canvas', () => {
    const session = service.createBroadcastSession('match-finals-01');

    expect(session.matchId).toBe('match-finals-01');
    expect(session.activeCameraLayout).toBe('DUAL_SPLIT');
    expect(session.streamResolution).toEqual(OBS_CANVAS_RESOLUTION);
    expect(session.streamResolution.width).toBe(1920);
    expect(session.streamResolution.height).toBe(1080);
    expect(session.streamResolution.targetFps).toBe(60);
    expect(session.lowerThird.visible).toBe(true);
  });

  it('switches camera layouts and records director action log', () => {
    service.createBroadcastSession('match-layout-test');

    const updated = service.switchCameraLayout('match-layout-test', 'PLAYER_1_FOCUS');
    expect(updated.activeCameraLayout).toBe('PLAYER_1_FOCUS');
    expect(updated.directorLog.some((l) => l.action === 'SWITCH_CAMERA_LAYOUT')).toBe(true);
  });

  it('configures lower-third score, ELO, and win probability graphics', () => {
    service.createBroadcastSession('match-graphics-test');

    const updated = service.setLowerThird('match-graphics-test', {
      player1Name: 'ViperCoder',
      player1Elo: 2240,
      player1Score: 2,
      player2Name: 'ByteMaster',
      player2Elo: 2190,
      player2Score: 1,
      winProbabilityP1: 0.64,
      winProbabilityP2: 0.36,
    });

    expect(updated.lowerThird.player1Name).toBe('ViperCoder');
    expect(updated.lowerThird.winProbabilityP1).toBe(0.64);
    expect(updated.lowerThird.player1Score).toBe(2);
  });

  it('triggers temporary lower-third flash graphic with auto-hide expiration', () => {
    service.createBroadcastSession('match-flash-test');

    const flash = service.triggerLowerThirdFlash('match-flash-test', {
      title: 'FIRST BLOOD!',
      subtitle: 'ViperCoder passed Test Case 1 in 14.2s',
      durationSec: 5,
    });

    expect(flash.title).toBe('FIRST BLOOD!');
    expect(flash.visible).toBe(true);
    expect(flash.autoHideTimestamp).toBeGreaterThan(Date.now());
  });

  it('toggles Picture-in-Picture code diff overlay', () => {
    service.createBroadcastSession('match-pip-test');

    const pip = service.configurePipOverlay('match-pip-test', {
      enabled: true,
      source: 'DIFF_VIEW',
      position: 'TOP_RIGHT',
      scale: 0.35,
    });

    expect(pip.enabled).toBe(true);
    expect(pip.source).toBe('DIFF_VIEW');
    expect(pip.position).toBe('TOP_RIGHT');
  });

  it('synchronizes media clocks between player streams and server with drift detection', () => {
    service.createBroadcastSession('match-sync-test');
    const now = 1700000000000;

    const syncResult = service.syncMediaClocks('match-sync-test', now - 15, now - 10, now);
    expect(syncResult.synchronized).toBe(true);
    expect(syncResult.clockSkewMs).toBeLessThan(50);
  });

  it('generates an OBS-compatible standalone 1080p browser source HTML document', () => {
    service.createBroadcastSession('match-obs-html', {
      lowerThird: {
        visible: true,
        title: 'Championship Grand Finals',
        subtitle: 'Round of 8',
        player1Name: 'Alice',
        player1Elo: 2200,
        player1Score: 1,
        player2Name: 'Bob',
        player2Elo: 2150,
        player2Score: 0,
        winProbabilityP1: 0.55,
        winProbabilityP2: 0.45,
        theme: 'CYBERPUNK',
      },
      pipOverlay: {
        enabled: true,
        source: 'DIFF_VIEW',
        position: 'TOP_RIGHT',
        scale: 0.3,
        opacity: 0.95,
      },
    });

    const html = service.generateObsBrowserSourceHtml('match-obs-html');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('width: 1920px');
    expect(html).toContain('height: 1080px');
    expect(html).toContain('Championship Grand Finals');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('pip-container');
  });
});
