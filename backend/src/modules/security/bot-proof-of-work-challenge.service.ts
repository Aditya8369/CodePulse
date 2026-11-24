import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class BotProofOfWorkChallengeService {
  public verifyProofOfWork(challenge: string, nonce: number, difficulty: number): boolean {
    const hash = crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
    const prefix = '0'.repeat(difficulty);
    return hash.startsWith(prefix);
  }
}
