import { Injectable, Logger } from '@nestjs/common';

export interface VoicePermission {
  channelId: string;
  canSpeak: boolean;
  canListen: boolean;
}

@Injectable()
export class BattleVoiceWebrtcRouterService {
  private readonly logger = new Logger(BattleVoiceWebrtcRouterService.name);

  public assignChannel(teamId: string, role: 'PLAYER' | 'COACH' | 'SPECTATOR'): VoicePermission {
    const channelId = `voice-team-${teamId}`;

    if (role === 'PLAYER') {
      return { channelId, canSpeak: true, canListen: true };
    }
    if (role === 'COACH') {
      return { channelId, canSpeak: false, canListen: true }; // Coach listen-only during match
    }
    return { channelId: 'broadcast-audience', canSpeak: false, canListen: true };
  }
}
