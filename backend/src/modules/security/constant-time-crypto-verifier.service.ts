import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class ConstantTimeCryptoVerifierService {
  public verifyTokens(knownToken: string, suppliedToken: string): boolean {
    const bufA = Buffer.from(knownToken, 'utf8');
    const bufB = Buffer.from(suppliedToken, 'utf8');

    if (bufA.length !== bufB.length) {
      // Execute dummy comparison to ensure constant execution duration
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }
}
