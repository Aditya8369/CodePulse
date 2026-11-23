import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export type CameraLayoutMode =
  | 'PLAYER_1_FOCUS'
  | 'PLAYER_2_FOCUS'
  | 'DUAL_SPLIT'
  | 'CODE_ONLY'
  | 'QUAD_VIEW'
  | 'INTERVIEW';

export type OverlayTheme = 'CYBERPUNK' | 'CLEAN_DARK' | 'GOLD_CHAMPIONSHIP';

export interface LowerThirdConfig {
  visible: boolean;
  title: string;
  subtitle: string;
  player1Name: string;
  player1Elo: number;
  player1Score: number;
  player2Name: string;
  player2Elo: number;
  player2Score: number;
  winProbabilityP1: number; // e.g. 0.58
  winProbabilityP2: number; // e.g. 0.42
  theme: OverlayTheme;
  autoHideTimestamp?: number;
}

export interface PipOverlayConfig {
  enabled: boolean;
  source: 'PLAYER_1_CODE' | 'PLAYER_2_CODE' | 'DIFF_VIEW' | 'CASTER_CAM';
  position: 'TOP_RIGHT' | 'TOP_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_LEFT';
  scale: number; // 0.15 - 0.45
  opacity: number; // 0.0 - 1.0
}

export interface StreamResolution {
  width: number;
  height: number;
  targetFps: number;
}

export interface BroadcastSessionState {
  matchId: string;
  activeCameraLayout: CameraLayoutMode;
  lowerThird: LowerThirdConfig;
  pipOverlay: PipOverlayConfig;
  streamResolution: StreamResolution;
  audioMutedMap: Record<string, boolean>;
  syncClockOffsetMs: number;
  lastTransitionTimestamp: number;
  directorLog: Array<{ timestamp: number; action: string; details: unknown }>;
}

export const OBS_CANVAS_RESOLUTION: StreamResolution = {
  width: 1920,
  height: 1080,
  targetFps: 60,
};

@Injectable()
export class BroadcastControllerService {
  private readonly sessions = new Map<string, BroadcastSessionState>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  /**
   * Initializes a new broadcast control room session for a tournament match
   */
  createBroadcastSession(
    matchId: string,
    initial?: Partial<BroadcastSessionState>,
  ): BroadcastSessionState {
    const session: BroadcastSessionState = {
      matchId,
      activeCameraLayout: initial?.activeCameraLayout ?? 'DUAL_SPLIT',
      lowerThird: {
        visible: initial?.lowerThird?.visible ?? true,
        title: initial?.lowerThird?.title ?? 'Nexus Grand Finals',
        subtitle: initial?.lowerThird?.subtitle ?? 'Best of 5 • Game 1',
        player1Name: initial?.lowerThird?.player1Name ?? 'Player 1',
        player1Elo: initial?.lowerThird?.player1Elo ?? 2100,
        player1Score: initial?.lowerThird?.player1Score ?? 0,
        player2Name: initial?.lowerThird?.player2Name ?? 'Player 2',
        player2Elo: initial?.lowerThird?.player2Elo ?? 2085,
        player2Score: initial?.lowerThird?.player2Score ?? 0,
        winProbabilityP1: initial?.lowerThird?.winProbabilityP1 ?? 0.52,
        winProbabilityP2: initial?.lowerThird?.winProbabilityP2 ?? 0.48,
        theme: initial?.lowerThird?.theme ?? 'CYBERPUNK',
      },
      pipOverlay: {
        enabled: initial?.pipOverlay?.enabled ?? false,
        source: initial?.pipOverlay?.source ?? 'DIFF_VIEW',
        position: initial?.pipOverlay?.position ?? 'TOP_RIGHT',
        scale: initial?.pipOverlay?.scale ?? 0.3,
        opacity: initial?.pipOverlay?.opacity ?? 0.95,
      },
      streamResolution: OBS_CANVAS_RESOLUTION,
      audioMutedMap: {},
      syncClockOffsetMs: 0,
      lastTransitionTimestamp: Date.now(),
      directorLog: [
        {
          timestamp: Date.now(),
          action: 'SESSION_INITIALIZED',
          details: { matchId },
        },
      ],
    };

    this.sessions.set(matchId, session);
    this.syncToRedis(session);
    return session;
  }

  getSession(matchId: string): BroadcastSessionState {
    const session = this.sessions.get(matchId);
    if (!session) {
      throw new NotFoundException(`Broadcast session for match "${matchId}" not found`);
    }
    return session;
  }

  getOrCreateSession(matchId: string): BroadcastSessionState {
    return this.sessions.get(matchId) ?? this.createBroadcastSession(matchId);
  }

  /**
   * Seamlessly switches active stream camera angle (Dual Split, Player 1 focus, etc.)
   */
  switchCameraLayout(matchId: string, layout: CameraLayoutMode): BroadcastSessionState {
    const session = this.getOrCreateSession(matchId);
    const prevLayout = session.activeCameraLayout;
    session.activeCameraLayout = layout;
    session.lastTransitionTimestamp = Date.now();

    session.directorLog.push({
      timestamp: Date.now(),
      action: 'SWITCH_CAMERA_LAYOUT',
      details: { previous: prevLayout, current: layout },
    });

    this.syncToRedis(session);
    return session;
  }

  /**
   * Configures animated lower-third statistics and win probabilities
   */
  setLowerThird(
    matchId: string,
    update: Partial<LowerThirdConfig>,
  ): BroadcastSessionState {
    const session = this.getOrCreateSession(matchId);
    session.lowerThird = {
      ...session.lowerThird,
      ...update,
    };

    session.directorLog.push({
      timestamp: Date.now(),
      action: 'UPDATE_LOWER_THIRD',
      details: update,
    });

    this.syncToRedis(session);
    return session;
  }

  /**
   * Triggers a temporary lower-third flash graphic with automated timeout
   */
  triggerLowerThirdFlash(
    matchId: string,
    params: { title: string; subtitle: string; durationSec: number },
  ): LowerThirdConfig {
    const session = this.getOrCreateSession(matchId);
    session.lowerThird.visible = true;
    session.lowerThird.title = params.title;
    session.lowerThird.subtitle = params.subtitle;
    session.lowerThird.autoHideTimestamp = Date.now() + params.durationSec * 1000;

    session.directorLog.push({
      timestamp: Date.now(),
      action: 'TRIGGER_LOWER_THIRD_FLASH',
      details: params,
    });

    this.syncToRedis(session);
    return session.lowerThird;
  }

  /**
   * Toggles and configures the Picture-in-Picture code diff overlay
   */
  configurePipOverlay(
    matchId: string,
    config: Partial<PipOverlayConfig>,
  ): PipOverlayConfig {
    const session = this.getOrCreateSession(matchId);
    session.pipOverlay = {
      ...session.pipOverlay,
      ...config,
    };

    session.directorLog.push({
      timestamp: Date.now(),
      action: 'CONFIGURE_PIP_OVERLAY',
      details: session.pipOverlay,
    });

    this.syncToRedis(session);
    return session.pipOverlay;
  }

  /**
   * NTP-inspired media clock synchronization for player webcams and code feeds to prevent drift
   */
  syncMediaClocks(
    matchId: string,
    p1ClientTimeMs: number,
    p2ClientTimeMs: number,
    serverTimeMs: number = Date.now(),
  ): { clockSkewMs: number; synchronized: boolean } {
    const session = this.getOrCreateSession(matchId);
    const avgClientTime = (p1ClientTimeMs + p2ClientTimeMs) / 2;
    const skew = Math.abs(serverTimeMs - avgClientTime);

    session.syncClockOffsetMs = serverTimeMs - avgClientTime;

    return {
      clockSkewMs: Number(skew.toFixed(2)),
      synchronized: skew < 50, // sub-50ms sync drift threshold
    };
  }

  /**
   * Generates a 1920x1080 60FPS standalone HTML OBS Browser Source overlay
   */
  generateObsBrowserSourceHtml(matchId: string): string {
    const session = this.getOrCreateSession(matchId);
    const { lowerThird, pipOverlay, activeCameraLayout } = session;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CodePulse Broadcast Overlay - ${matchId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #fff;
    }
    .broadcast-container {
      position: relative;
      width: 1920px;
      height: 1080px;
      display: flex;
    }
    .camera-layout {
      width: 100%;
      height: 100%;
      display: grid;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .layout-DUAL_SPLIT { grid-template-columns: 1fr 1fr; }
    .layout-PLAYER_1_FOCUS { grid-template-columns: 3fr 1fr; }
    .layout-PLAYER_2_FOCUS { grid-template-columns: 1fr 3fr; }
    .layout-CODE_ONLY { grid-template-columns: 1fr; }
    
    .cam-pane {
      position: relative;
      border: 2px solid rgba(59, 130, 246, 0.3);
      background: rgba(10, 15, 30, 0.7);
      overflow: hidden;
    }

    /* Picture in Picture Window */
    .pip-container {
      position: absolute;
      width: 576px;
      height: 324px;
      border-radius: 8px;
      border: 2px solid #3b82f6;
      box-shadow: 0 8px 32px rgba(0,0,0,0.8);
      background: #0f172a;
      transition: all 0.25s ease-out;
      display: ${pipOverlay.enabled ? 'block' : 'none'};
      ${pipOverlay.position === 'TOP_RIGHT' ? 'top: 32px; right: 32px;' : ''}
      ${pipOverlay.position === 'TOP_LEFT' ? 'top: 32px; left: 32px;' : ''}
      ${pipOverlay.position === 'BOTTOM_RIGHT' ? 'bottom: 140px; right: 32px;' : ''}
      ${pipOverlay.position === 'BOTTOM_LEFT' ? 'bottom: 140px; left: 32px;' : ''}
    }

    /* Lower Third Animated Graphics */
    .lower-third {
      position: absolute;
      bottom: 24px;
      left: 64px;
      right: 64px;
      height: 88px;
      background: linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%);
      border: 1px solid rgba(255,255,255,0.15);
      border-left: 6px solid #3b82f6;
      border-radius: 6px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.7);
      display: ${lowerThird.visible ? 'flex' : 'none'};
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      animation: slideUp 0.4s ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(120px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .player-stat { display: flex; align-items: center; gap: 16px; }
    .player-name { font-size: 24px; font-weight: 700; }
    .player-elo { font-size: 16px; color: #94a3b8; }
    .win-prob { font-size: 20px; font-weight: 600; color: #10b981; }
  </style>
</head>
<body>
  <div class="broadcast-container">
    <div id="camera-grid" class="camera-layout layout-${activeCameraLayout}">
      <div class="cam-pane" id="cam-player-1"></div>
      <div class="cam-pane" id="cam-player-2"></div>
    </div>
    <div class="pip-container" id="pip-window"></div>
    <div class="lower-third" id="lower-third-overlay">
      <div class="player-stat">
        <span class="player-name">${lowerThird.player1Name}</span>
        <span class="player-elo">${lowerThird.player1Elo} ELO</span>
        <span class="win-prob">${(lowerThird.winProbabilityP1 * 100).toFixed(0)}%</span>
      </div>
      <div>
        <h2 style="font-size: 22px; text-align: center; color: #f8fafc;">${lowerThird.title}</h2>
        <p style="font-size: 14px; text-align: center; color: #64748b;">${lowerThird.subtitle}</p>
      </div>
      <div class="player-stat">
        <span class="win-prob">${(lowerThird.winProbabilityP2 * 100).toFixed(0)}%</span>
        <span class="player-elo">${lowerThird.player2Elo} ELO</span>
        <span class="player-name">${lowerThird.player2Name}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private syncToRedis(session: BroadcastSessionState): void {
    if (this.redis) {
      try {
        const client = (this.redis as unknown as { getClient?: () => { setex?: (k: string, s: number, v: string) => Promise<unknown> } }).getClient?.();
        if (client?.setex) {
          client.setex(`broadcast:session:${session.matchId}`, 7200, JSON.stringify(session)).catch(() => {});
        }
      } catch {
        // non-blocking
      }
    }
  }
}
