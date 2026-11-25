import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CustomDomainCnameVerifierService {
  private readonly logger = new Logger(CustomDomainCnameVerifierService.name);
  private readonly EXPECTED_CNAME_TARGET = 'cname.codepulse.io';

  public verifyCname(domain: string, resolvedTarget: string): { verified: boolean; domain: string; sslReady: boolean } {
    const verified = resolvedTarget.toLowerCase() === this.EXPECTED_CNAME_TARGET;
    if (verified) {
      this.logger.log(`Domain ${domain} verified successfully pointing to ${this.EXPECTED_CNAME_TARGET}`);
    } else {
      this.logger.warn(`Domain ${domain} CNAME mismatch: got ${resolvedTarget}, expected ${this.EXPECTED_CNAME_TARGET}`);
    }

    return {
      verified,
      domain,
      sslReady: verified
    };
  }
}
