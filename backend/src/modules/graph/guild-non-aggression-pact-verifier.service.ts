import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PactAgreement {
  guildA: string;
  guildB: string;
  expiresAt: number;
  signA: string;
  signB: string;
}

@Injectable()
export class GuildNonAggressionPactVerifierService {
  private readonly logger = new Logger(GuildNonAggressionPactVerifierService.name);

  public generateAgreementHash(guildA: string, guildB: string, expiresAt: number): string {
    const sorted = [guildA, guildB].sort().join(':');
    return crypto.createHash('sha256').update(`${sorted}:${expiresAt}`).digest('hex');
  }

  public verifyPact(pact: PactAgreement, now: number = Date.now()): boolean {
    if (pact.expiresAt <= now) {
      this.logger.warn('Pact has expired.');
      return false;
    }
    const expectedHash = this.generateAgreementHash(pact.guildA, pact.guildB, pact.expiresAt);
    return pact.signA.length > 0 && pact.signB.length > 0 && pact.signA === expectedHash;
  }
}
