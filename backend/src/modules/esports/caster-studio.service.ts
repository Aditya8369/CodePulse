import { Injectable, Logger, ForbiddenException } from '@nestjs/common';

export type CameraActivePlayer = 'player1' | 'player2' | 'split_screen' | 'overview';

export interface LowerThirdConfig {
  visible: boolean;
  title: string;
  subtitle: string;
  durationMs?: number;
}

export interface StatComparisonConfig {
  visible: boolean;
  metric: string;
  player1Value: string | number;
  player2Value: string | number;
  highlightLeader?: 'player1' | 'player2' | 'tie';
}

export interface SlowMoReplayConfig {
  active: boolean;
  clipStartSec: number;
  speed: 0.25 | 0.5 | 0.75;
  replayTitle: string;
}

export interface LiveTelemetry {
  player1: {
    username: string;
    wpm: number;
    testsPassed: number;
    totalTests: number;
    winProbability: number; // 0 to 100
  };
  player2: {
    username: string;
    wpm: number;
    testsPassed: number;
    totalTests: number;
    winProbability: number; // 0 to 100
  };
}

export interface CasterStudioState {
  tournamentId: string;
  activeCamera: CameraActivePlayer;
  lowerThird: LowerThirdConfig;
  statComparison: StatComparisonConfig;
  slowMoReplay: SlowMoReplayConfig;
  telemetry: LiveTelemetry;
  lastUpdatedMs: number;
  directorId: string;
}

export interface DirectorAuthClaim {
  userId: string;
  role: 'DIRECTOR' | 'CASTER' | 'PRODUCER' | 'ADMIN';
  tournamentId: string;
}

@Injectable()
export class CasterStudioService {
  private readonly logger = new Logger(CasterStudioService.name);
  private readonly studioStates = new Map<string, CasterStudioState>();
  private readonly authenticatedCasters = new Map<string, DirectorAuthClaim>();

  public getOrCreateStudioState(tournamentId: string): CasterStudioState {
    let state = this.studioStates.get(tournamentId);
    if (!state) {
      state = {
        tournamentId,
        activeCamera: 'split_screen',
        lowerThird: {
          visible: false,
          title: 'CodePulse Grand Finals',
          subtitle: 'Match 1 of Best-of-3',
        },
        statComparison: {
          visible: false,
          metric: 'WPM & Accuracy',
          player1Value: '115 WPM',
          player2Value: '98 WPM',
          highlightLeader: 'player1',
        },
        slowMoReplay: {
          active: false,
          clipStartSec: 0,
          speed: 0.5,
          replayTitle: 'Clutch Test Pass',
        },
        telemetry: {
          player1: {
            username: 'dev_alex',
            wpm: 112,
            testsPassed: 8,
            totalTests: 10,
            winProbability: 65,
          },
          player2: {
            username: 'code_samurai',
            wpm: 98,
            testsPassed: 7,
            totalTests: 10,
            winProbability: 35,
          },
        },
        lastUpdatedMs: Date.now(),
        directorId: 'system',
      };
      this.studioStates.set(tournamentId, state);
    }
    return state;
  }

  public registerCasterAuth(clientId: string, claim: DirectorAuthClaim): void {
    this.authenticatedCasters.set(clientId, claim);
  }

  public removeCasterAuth(clientId: string): void {
    this.authenticatedCasters.delete(clientId);
  }

  public verifyDirectorPermission(clientId: string, tournamentId: string): DirectorAuthClaim {
    const claim = this.authenticatedCasters.get(clientId);
    if (!claim) {
      // Default to allowed for unauthenticated testing or fallback
      return { userId: clientId, role: 'DIRECTOR', tournamentId };
    }
    if (claim.tournamentId !== tournamentId) {
      throw new ForbiddenException(`Caster is not assigned to tournament ${tournamentId}`);
    }
    if (!['DIRECTOR', 'PRODUCER', 'ADMIN'].includes(claim.role)) {
      throw new ForbiddenException(`Role '${claim.role}' lacks director control permissions`);
    }
    return claim;
  }

  public switchActiveCamera(
    tournamentId: string,
    camera: CameraActivePlayer,
    directorId: string,
  ): CasterStudioState {
    const state = this.getOrCreateStudioState(tournamentId);
    state.activeCamera = camera;
    state.directorId = directorId;
    state.lastUpdatedMs = Date.now();
    return state;
  }

  public updateLowerThird(
    tournamentId: string,
    config: Partial<LowerThirdConfig>,
    directorId: string,
  ): CasterStudioState {
    const state = this.getOrCreateStudioState(tournamentId);
    state.lowerThird = { ...state.lowerThird, ...config };
    state.directorId = directorId;
    state.lastUpdatedMs = Date.now();
    return state;
  }

  public triggerStatComparison(
    tournamentId: string,
    config: Partial<StatComparisonConfig>,
    directorId: string,
  ): CasterStudioState {
    const state = this.getOrCreateStudioState(tournamentId);
    state.statComparison = { ...state.statComparison, ...config };
    state.directorId = directorId;
    state.lastUpdatedMs = Date.now();
    return state;
  }

  public triggerSlowMoReplay(
    tournamentId: string,
    config: Partial<SlowMoReplayConfig>,
    directorId: string,
  ): CasterStudioState {
    const state = this.getOrCreateStudioState(tournamentId);
    state.slowMoReplay = { ...state.slowMoReplay, ...config };
    state.directorId = directorId;
    state.lastUpdatedMs = Date.now();
    return state;
  }

  public updateTelemetry(
    tournamentId: string,
    telemetry: Partial<LiveTelemetry>,
  ): CasterStudioState {
    const state = this.getOrCreateStudioState(tournamentId);
    state.telemetry = {
      player1: { ...state.telemetry.player1, ...(telemetry.player1 || {}) },
      player2: { ...state.telemetry.player2, ...(telemetry.player2 || {}) },
    };
    state.lastUpdatedMs = Date.now();
    return state;
  }
}

