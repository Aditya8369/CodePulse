import { Injectable, Logger } from '@nestjs/common';

export interface SpatialAudioConfig {
  panning: number; // -1.0 (hard left) to +1.0 (hard right)
  volume: number;  // 0.0 to 1.0
  agcEnabled: boolean;
  noiseSuppression: boolean;
  vadActive: boolean;
  participantRole: 'player1' | 'player2' | 'caster' | 'spectator';
}

export interface ParticipantAudioState {
  userId: string;
  battleId: string;
  role: 'player1' | 'player2' | 'caster' | 'spectator';
  spatialConfig: SpatialAudioConfig;
  lastSpeakingTimestampMs: number;
  isSpeaking: boolean;
  audioPacketsTransmitted: number;
  audioPacketsSuppressed: number; // Bandwidth saved by VAD
}

@Injectable()
export class SpatialAudioService {
  private readonly logger = new Logger(SpatialAudioService.name);
  private readonly roomParticipants = new Map<string, Map<string, ParticipantAudioState>>();

  /**
   * Initializes or updates a participant in an audio battle room
   * Automatically sets default spatial stereo panning:
   * Player 1 -> -0.3 (30% left channel)
   * Player 2 -> +0.3 (30% right channel)
   */
  public registerParticipant(
    battleId: string,
    userId: string,
    role: 'player1' | 'player2' | 'caster' | 'spectator',
  ): ParticipantAudioState {
    if (!this.roomParticipants.has(battleId)) {
      this.roomParticipants.set(battleId, new Map());
    }

    const room = this.roomParticipants.get(battleId)!;

    let defaultPanning = 0.0;
    if (role === 'player1') {
      defaultPanning = -0.3; // 30% left channel for spectators
    } else if (role === 'player2') {
      defaultPanning = 0.3;  // 30% right channel for spectators
    }

    const state: ParticipantAudioState = {
      userId,
      battleId,
      role,
      spatialConfig: {
        panning: defaultPanning,
        volume: 1.0,
        agcEnabled: true,
        noiseSuppression: true,
        vadActive: false,
        participantRole: role,
      },
      lastSpeakingTimestampMs: 0,
      isSpeaking: false,
      audioPacketsTransmitted: 0,
      audioPacketsSuppressed: 0,
    };

    room.set(userId, state);
    this.logger.debug(`Registered audio participant ${userId} as ${role} in battle ${battleId}`);
    return state;
  }

  public removeParticipant(battleId: string, userId: string): void {
    const room = this.roomParticipants.get(battleId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.roomParticipants.delete(battleId);
      }
    }
  }

  /**
   * Updates Voice Activity Detection (VAD) state from client or audio analyzer
   */
  public updateVadState(
    battleId: string,
    userId: string,
    isSpeaking: boolean,
  ): { state: ParticipantAudioState; bandwidthSavingsPercent: number } | null {
    const room = this.roomParticipants.get(battleId);
    const participant = room?.get(userId);
    if (!participant) return null;

    participant.isSpeaking = isSpeaking;
    participant.spatialConfig.vadActive = isSpeaking;

    if (isSpeaking) {
      participant.lastSpeakingTimestampMs = Date.now();
      participant.audioPacketsTransmitted += 1;
    } else {
      participant.audioPacketsSuppressed += 1;
    }

    const totalPackets = participant.audioPacketsTransmitted + participant.audioPacketsSuppressed;
    const bandwidthSavingsPercent =
      totalPackets > 0
        ? Number(((participant.audioPacketsSuppressed / totalPackets) * 100).toFixed(1))
        : 60.0;

    return { state: participant, bandwidthSavingsPercent };
  }

  /**
   * Updates spatial audio panning & spectator volume slider values
   */
  public updateSpatialConfig(
    battleId: string,
    userId: string,
    config: Partial<SpatialAudioConfig>,
  ): SpatialAudioConfig | null {
    const room = this.roomParticipants.get(battleId);
    const participant = room?.get(userId);
    if (!participant) return null;

    participant.spatialConfig = {
      ...participant.spatialConfig,
      ...config,
    };

    return participant.spatialConfig;
  }

  /**
   * Returns all audio participants and their spatial stereo layouts for a battle room
   */
  public getRoomAudioLayout(battleId: string): ParticipantAudioState[] {
    const room = this.roomParticipants.get(battleId);
    if (!room) return [];
    return Array.from(room.values());
  }

  /**
   * Calculates overall room voice activity and bandwidth reduction
   */
  public getRoomBandwidthMetrics(battleId: string): {
    totalTransmitted: number;
    totalSuppressed: number;
    bandwidthSavedPercent: number;
  } {
    const participants = this.getRoomAudioLayout(battleId);
    let totalTransmitted = 0;
    let totalSuppressed = 0;

    for (const p of participants) {
      totalTransmitted += p.audioPacketsTransmitted;
      totalSuppressed += p.audioPacketsSuppressed;
    }

    const total = totalTransmitted + totalSuppressed;
    const bandwidthSavedPercent =
      total > 0 ? Number(((totalSuppressed / total) * 100).toFixed(1)) : 60.0;

    return { totalTransmitted, totalSuppressed, bandwidthSavedPercent };
  }
}

