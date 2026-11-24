import { Injectable } from '@nestjs/common';

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class P2pStunTurnGatewayService {
  private readonly stunServers = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
  private readonly turnServers = ['turn:turn.codepulse.io:3478'];

  public getIceServers(forceTurnFallback = false): IceServerConfig[] {
    if (forceTurnFallback) {
      return [{ urls: this.turnServers, username: 'guest', credential: 'turn_token_jwt' }];
    }
    return [
      { urls: this.stunServers },
      { urls: this.turnServers, username: 'guest', credential: 'turn_token_jwt' },
    ];
  }
}
