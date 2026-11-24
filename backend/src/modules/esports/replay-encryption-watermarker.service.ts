import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ReplayEncryptionWatermarkerService {
  private readonly logger = new Logger(ReplayEncryptionWatermarkerService.name);

  public signReplayData(matchId: string, rawReplayBytes: string, secretKey: string): { watermarkedData: string; signature: string } {
    const signature = crypto.createHmac('sha256', secretKey).update(`${matchId}:${rawReplayBytes}`).digest('hex');
    const watermarkedData = `CP_REPLAY_V1:${signature}:${rawReplayBytes}`;
    return { watermarkedData, signature };
  }

  public verifyReplay(matchId: string, watermarkedString: string, secretKey: string): boolean {
    const parts = watermarkedString.split(':');
    if (parts.length < 3 || parts[0] !== 'CP_REPLAY_V1') return false;

    const signature = parts[1];
    const rawData = parts.slice(2).join(':');
    const expected = crypto.createHmac('sha256', secretKey).update(`${matchId}:${rawData}`).digest('hex');

    return signature === expected;
  }
}
