import { Injectable } from '@nestjs/common';

@Injectable()
export class WalDiskBloatPrunerService {
  private readonly maxWalSizeBytes = 10 * 1024 * 1024 * 1024; // 10GB

  public evaluateCheckpointTrigger(currentWalBytes: number): { triggerCheckpoint: boolean; reason: string } {
    if (currentWalBytes >= this.maxWalSizeBytes) {
      return {
        triggerCheckpoint: true,
        reason: `WAL size ${Math.round(currentWalBytes / (1024 * 1024))}MB exceeds 10GB threshold. Forcing CHECKPOINT.`,
      };
    }
    return { triggerCheckpoint: false, reason: 'WAL usage within nominal bounds' };
  }
}
