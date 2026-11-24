import { Injectable, Logger } from '@nestjs/common';

export interface DeltaPacket {
  seq: number;
  action: string;
}

@Injectable()
export class BattleReconnectDesyncGuardService {
  private readonly logger = new Logger(BattleReconnectDesyncGuardService.name);

  public computeCatchup(clientSeq: number, serverHeadSeq: number, history: DeltaPacket[]): { catchupDeltas: DeltaPacket[]; fullSyncNeeded: boolean } {
    if (serverHeadSeq - clientSeq > 500) {
      this.logger.warn(`Client ${clientSeq} is over 500 ticks behind head ${serverHeadSeq}. Full snapshot required.`);
      return { catchupDeltas: [], fullSyncNeeded: true };
    }

    const catchupDeltas = history.filter(d => d.seq > clientSeq && d.seq <= serverHeadSeq);
    return { catchupDeltas, fullSyncNeeded: false };
  }
}
