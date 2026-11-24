import { Injectable, Logger } from '@nestjs/common';

export interface AdjudicationVerdict {
  ruling: 'CONFIRMED_SERVER_MATCH' | 'CLIENT_TAMPER_DETECTED' | 'INDETERMINATE';
  consensusPercent: number;
}

@Injectable()
export class DisputeAdjudicationSnapshotsService {
  private readonly logger = new Logger(DisputeAdjudicationSnapshotsService.name);

  public adjudicate(serverHash: string, clientHashes: string[]): AdjudicationVerdict {
    if (clientHashes.length === 0) {
      return { ruling: 'INDETERMINATE', consensusPercent: 0 };
    }

    const matches = clientHashes.filter(h => h === serverHash).length;
    const consensusPercent = Math.round((matches / clientHashes.length) * 100);

    if (consensusPercent >= 66) {
      return { ruling: 'CONFIRMED_SERVER_MATCH', consensusPercent };
    }

    return { ruling: 'CLIENT_TAMPER_DETECTED', consensusPercent };
  }
}
