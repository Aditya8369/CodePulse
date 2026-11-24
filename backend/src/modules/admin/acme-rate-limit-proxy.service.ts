import { Injectable, Logger } from '@nestjs/common';

export type CaProvider = 'LETS_ENCRYPT' | 'ZEROSSL' | 'BYO_CERT';

@Injectable()
export class AcmeRateLimitProxyService {
  private readonly logger = new Logger(AcmeRateLimitProxyService.name);
  private currentProvider: CaProvider = 'LETS_ENCRYPT';

  public requestCertificate(domain: string, isRateLimited: boolean): { provider: CaProvider; domain: string } {
    if (isRateLimited) {
      this.logger.warn(`Let's Encrypt rate limit encountered for ${domain}. Failing over to ZeroSSL.`);
      this.currentProvider = 'ZEROSSL';
    } else {
      this.currentProvider = 'LETS_ENCRYPT';
    }
    return { provider: this.currentProvider, domain };
  }
}
