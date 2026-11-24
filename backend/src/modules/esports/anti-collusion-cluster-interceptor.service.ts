import { Injectable, Logger } from '@nestjs/common';

export interface PlayerClientSignature {
  playerId: string;
  ipAddress: string;
  hardwareHash: string;
}

@Injectable()
export class AntiCollusionClusterInterceptorService {
  private readonly logger = new Logger(AntiCollusionClusterInterceptorService.name);

  public validateMatchup(playerA: PlayerClientSignature, playerB: PlayerClientSignature): { allowed: boolean; violationReason?: string } {
    if (playerA.ipAddress === playerB.ipAddress) {
      this.logger.warn(`Blocked collusion match between ${playerA.playerId} and ${playerB.playerId}: Shared IP ${playerA.ipAddress}`);
      return { allowed: false, violationReason: 'SHARED_IP_SUBNET' };
    }

    if (playerA.hardwareHash === playerB.hardwareHash) {
      this.logger.warn(`Blocked collusion match between ${playerA.playerId} and ${playerB.playerId}: Shared Hardware ID`);
      return { allowed: false, violationReason: 'SHARED_HARDWARE_FINGERPRINT' };
    }

    return { allowed: true };
  }
}
